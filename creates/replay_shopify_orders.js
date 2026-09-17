'use strict';

const {
  COMPLIANCE_CHOICES,
  createAdjustmentMatcher,
  createCaseGoodsAdjustment,
  findLotIdByCode,
  validateWineryId,
} = require('../lib/innovint');
const {getOrderByNumber, requireShopifyCredentials} = require('../lib/shopify');
const {describeError} = require('../lib/errors');
const {
  MAX_ORDERS_PER_RUN,
  PROBLEM_LINE_RESULTS,
  PROBLEM_ORDER_STATUSES,
  buildAdjustments,
  isCaseGoodsSku,
  isSwitchedOn,
  parseOrderNumbers,
  skipReason,
  timeBudgetMs,
} = require('../lib/replay');

/** Replaying a paid order can only ever mean a tax-paid removal. */
const COMPLIANCE = COMPLIANCE_CHOICES.REMOVED_TAXPAID;

/** Errors that will repeat for every remaining order, so the run stops. */
const FATAL_ERROR_CODES = ['ShopifyNotConfigured', 'ShopifyAuthError', 'ShopifyNotFound', 'AuthenticationError'];

const isFatal = (error) => {
  if (!error) {
    return false;
  }
  if (FATAL_ERROR_CODES.includes(error.name)) {
    return true;
  }
  try {
    return FATAL_ERROR_CODES.includes(JSON.parse(error.message).code);
  } catch (parseError) {
    return false;
  }
};

/**
 * Sums up what happened, for the message on a failed run.
 *
 * @param {Object} output - The action output.
 * @return {string} One paragraph a person can act on.
 */
const problemSummary = (output) => {
  const problems = [
    ...output.orders
        .filter((order) => PROBLEM_ORDER_STATUSES.includes(order.status))
        .map((order) => `#${order.orderNumber} ${order.status}${order.error ? ` (${order.error})` : ''}`),
    ...output.lines
        .filter((line) => PROBLEM_LINE_RESULTS.includes(line.result))
        .map((line) => `#${line.orderNumber} ${line.sku} ${line.result}${line.error ? ` (${line.error})` : ''}`),
  ];
  return [
    `Recorded ${output.linesRecorded} line(s) in InnoVint; ${problems.length} need attention.`,
    problems.length ? `Not recorded: ${problems.join(' | ')}` : '',
    'Anything already recorded is skipped when you run this again.',
  ].filter(Boolean).join(' ').slice(0, 1800);
};

const perform = async (z, bundle) => {
  const startedAt = Date.now();
  const budgetMs = timeBudgetMs();
  const wineryId = validateWineryId(z, bundle.inputData.wineryId);
  const dryRun = isSwitchedOn(bundle.inputData.dryRun);
  const skipAlreadyRecorded = isSwitchedOn(bundle.inputData.skipAlreadyRecorded);
  const {numbers: orderNumbers, invalid} = parseOrderNumbers(bundle.inputData.orderNumbers);

  if (invalid.length) {
    throw new z.errors.Error(
        `These are not Shopify order numbers: ${invalid.slice(0, 10).join(', ')}`,
        'InvalidInput',
        400,
    );
  }
  if (!orderNumbers.length) {
    throw new z.errors.Error('Enter at least one Shopify order number.', 'InvalidInput', 400);
  }
  if (orderNumbers.length > MAX_ORDERS_PER_RUN) {
    throw new z.errors.Error(
        `Replay at most ${MAX_ORDERS_PER_RUN} orders per run (you entered ${orderNumbers.length}).`,
        'InvalidInput',
        400,
    );
  }

  // Fail now rather than once per order if the connection is not set up.
  requireShopifyCredentials(z, bundle);

  const lotIds = new Map();
  const matcher = createAdjustmentMatcher(z, wineryId);
  const orders = [];
  const lines = [];
  let stopped = null;

  for (const orderNumber of orderNumbers) {
    const result = {
      orderNumber,
      status: '',
      financialStatus: null,
      effectiveAt: null,
      lineCount: 0,
      error: null,
    };
    orders.push(result);

    if (stopped) {
      result.status = 'not_processed';
      result.error = stopped;
      continue;
    }
    if (Date.now() - startedAt > budgetMs) {
      result.status = 'not_processed';
      result.error = 'Stopped before this order to stay inside Zapier\'s time limit. Run it again for the rest.';
      continue;
    }

    let order;
    try {
      order = await getOrderByNumber(z, bundle, orderNumber);
    } catch (error) {
      result.status = 'error';
      result.error = describeError(error);
      if (isFatal(error)) {
        stopped = result.error;
      }
      continue;
    }

    if (!order) {
      result.status = 'order_not_found';
      result.error = `Shopify has no order #${orderNumber}. If it is more than 60 days old, the Shopify ` +
        'custom app also needs the read_all_orders scope.';
      continue;
    }

    result.financialStatus = order.displayFinancialStatus || null;
    result.effectiveAt = order.processedAt || order.createdAt;

    const skipped = skipReason(order);
    if (skipped) {
      result.status = skipped;
      continue;
    }

    const adjustments = buildAdjustments(order);
    if (!adjustments.length) {
      result.status = 'no_case_goods';
      continue;
    }

    for (const {sku, bottles, orderedBottles} of adjustments) {
      const line = {
        orderNumber,
        sku,
        bottles,
        orderedBottles,
        effectiveAt: result.effectiveAt,
        lotId: null,
        result: '',
        referenceNumber: null,
        error: null,
      };
      lines.push(line);
      result.lineCount++;

      if (Date.now() - startedAt > budgetMs) {
        line.result = 'not_processed';
        line.error = 'Stopped before this line to stay inside Zapier\'s time limit. Run it again for the rest.';
        continue;
      }

      if (!isCaseGoodsSku(sku)) {
        line.result = 'invalid_sku';
        line.error = `"${sku.slice(0, 40)}" is not a usable case goods code.`;
        continue;
      }
      if (bottles <= 0) {
        line.result = 'skipped_removed_from_order';
        line.error = `All ${orderedBottles} bottle(s) were refunded or removed from the order.`;
        continue;
      }

      try {
        if (!lotIds.has(sku)) {
          lotIds.set(sku, await findLotIdByCode(z, wineryId, sku));
        }
        line.lotId = lotIds.get(sku);
        if (!line.lotId) {
          line.result = 'lot_not_found';
          line.error = `No InnoVint lot has the code ${sku}.`;
          continue;
        }

        if (skipAlreadyRecorded) {
          const existing = await matcher.find({
            lotId: line.lotId,
            compliance: COMPLIANCE,
            effectiveAt: result.effectiveAt,
          });
          if (existing && existing.match === 'exact') {
            line.result = 'already_recorded';
            line.referenceNumber = existing.adjustment.referenceNumber || null;
            continue;
          }
          if (existing && existing.match === 'possible') {
            line.result = 'possible_duplicate';
            line.referenceNumber = existing.adjustment.referenceNumber || null;
            line.error = `InnoVint already has an adjustment on this lot at ${existing.adjustment.effectiveAt}, ` +
              `close to this order's time (${result.effectiveAt}). Check it in InnoVint. If it belongs to a ` +
              'different order, replay this one order on its own with Skip Lines Already in InnoVint turned off.';
            continue;
          }
        }

        if (dryRun) {
          line.result = 'would_record';
          continue;
        }

        line.referenceNumber = await createCaseGoodsAdjustment(z, {
          wineryId,
          lotId: line.lotId,
          bottles,
          compliance: COMPLIANCE,
          effectiveAt: result.effectiveAt,
        });
        line.result = 'recorded';
      } catch (error) {
        line.result = 'error';
        line.error = describeError(error);
        if (isFatal(error)) {
          stopped = line.error;
          break;
        }
      }
    }

    const outcomes = new Set(lines.filter((line) => line.orderNumber === orderNumber).map((line) => line.result));
    result.status = outcomes.size === 1 ? [...outcomes][0] : 'mixed';
  }

  const countLines = (value) => lines.filter((line) => line.result === value).length;
  const problemLines = lines.filter((line) => PROBLEM_LINE_RESULTS.includes(line.result));
  const output = {
    dryRun,
    ordersRequested: orderNumbers.length,
    linesRecorded: countLines('recorded'),
    linesWouldRecord: countLines('would_record'),
    linesAlreadyRecorded: countLines('already_recorded'),
    linesWithProblems: problemLines.length,
    ordersWithProblems: orders.filter((order) =>
      PROBLEM_ORDER_STATUSES.includes(order.status) ||
      problemLines.some((line) => line.orderNumber === order.orderNumber)).length,
    orders,
    lines,
  };

  z.console.log('Replay Shopify Orders result', JSON.stringify(output));

  if (!dryRun && output.ordersWithProblems) {
    // A Zap step that returns normally looks successful, and missing removals
    // would go unnoticed.
    throw new z.errors.Error(problemSummary(output), 'ReplayIncomplete', 400);
  }

  return output;
};

module.exports = {
  key: 'replayShopifyOrders',
  noun: 'Shopify Order Replay',
  display: {
    label: 'Replay Shopify Orders',
    description:
      'Records the bottled-wine removals for paid Shopify orders the Zap missed. Reads each order from Shopify, ' +
      'skips anything already in InnoVint, and runs as a preview unless Dry Run is turned off.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'wineryId',
        label: 'Winery',
        required: true,
        type: 'string',
        dynamic: 'listWineriesDropdown.id.name',
      },
      {
        key: 'orderNumbers',
        label: 'Shopify Order Numbers',
        required: true,
        type: 'string',
        list: true,
        helpText:
          `Order numbers such as 3495 or #3495. Enter one per line or separate them with commas. ` +
          `At most ${MAX_ORDERS_PER_RUN} per run. Every line is recorded as a tax-paid removal ` +
          `(${COMPLIANCE}) dated at the order's Shopify payment time.`,
      },
      {
        key: 'dryRun',
        label: 'Dry Run',
        required: false,
        type: 'boolean',
        default: 'true',
        helpText: 'Yes shows what would be recorded without changing InnoVint. Only an explicit No records.',
      },
      {
        key: 'skipAlreadyRecorded',
        label: 'Skip Lines Already in InnoVint',
        required: false,
        type: 'boolean',
        default: 'true',
        helpText:
          'Yes skips a line when InnoVint already has the same removal for that lot at the order\'s time, and ' +
          'flags anything recorded within two minutes of it for you to check. Leave this on.',
      },
    ],
    outputFields: [
      {key: 'dryRun', label: 'Dry Run', type: 'boolean'},
      {key: 'ordersRequested', label: 'Orders Requested', type: 'integer'},
      {key: 'linesRecorded', label: 'Lines Recorded', type: 'integer'},
      {key: 'linesWouldRecord', label: 'Lines That Would Be Recorded', type: 'integer'},
      {key: 'linesAlreadyRecorded', label: 'Lines Already Recorded', type: 'integer'},
      {key: 'linesWithProblems', label: 'Lines With Problems', type: 'integer'},
      {key: 'ordersWithProblems', label: 'Orders With Problems', type: 'integer'},
      {key: 'lines[]orderNumber', label: 'Line Order Number', type: 'string'},
      {key: 'lines[]sku', label: 'Line SKU', type: 'string'},
      {key: 'lines[]bottles', label: 'Line Bottles', type: 'integer'},
      {key: 'lines[]result', label: 'Line Result', type: 'string'},
      {key: 'lines[]lotId', label: 'Line Lot ID', type: 'string'},
      {key: 'lines[]referenceNumber', label: 'Line Reference Number', type: 'string'},
      {key: 'lines[]error', label: 'Line Problem', type: 'string'},
    ],
    sample: {
      dryRun: true,
      ordersRequested: 1,
      linesRecorded: 0,
      linesWouldRecord: 1,
      linesAlreadyRecorded: 0,
      linesWithProblems: 0,
      ordersWithProblems: 0,
      orders: [{
        orderNumber: '3499',
        status: 'would_record',
        financialStatus: 'PAID',
        effectiveAt: '2026-04-04T20:07:53Z',
        lineCount: 1,
        error: null,
      }],
      lines: [{
        orderNumber: '3499',
        sku: 'CG-B1700RCVMER',
        bottles: 2,
        orderedBottles: 2,
        effectiveAt: '2026-04-04T20:07:53Z',
        lotId: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y',
        result: 'would_record',
        referenceNumber: null,
        error: null,
      }],
    },
  },
};
