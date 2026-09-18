'use strict';

const {
  COMPLIANCE_CHOICES,
  createAdjustmentMatcher,
  createCaseGoodsAdjustment,
  findLotIdByCode,
  validateWineryId,
} = require('../lib/innovint');
const {describeError} = require('../lib/errors');
const {
  PROBLEM_LINE_RESULTS,
  buildAdjustments,
  isCaseGoodsSku,
  isSwitchedOn,
  skipReason,
  splitList,
} = require('../lib/replay');

/** Replaying a paid order can only ever mean a tax-paid removal. */
const COMPLIANCE = COMPLIANCE_CHOICES.REMOVED_TAXPAID;

/**
 * Sums up what happened, for the message on a failed run.
 *
 * @param {Object} output - The action output.
 * @return {string} One paragraph a person can act on.
 */
const problemSummary = (output) => {
  const problems = output.lines
      .filter((line) => PROBLEM_LINE_RESULTS.includes(line.result))
      .map((line) => `${line.sku} ${line.result}${line.error ? ` (${line.error})` : ''}`);
  return [
    `Order ${output.orderNumber}: recorded ${output.linesRecorded} line(s) in InnoVint;`,
    `${problems.length} need attention.`,
    problems.length ? `Not recorded: ${problems.join(' | ')}` : '',
    'Anything already recorded is skipped when you run this again.',
  ].filter(Boolean).join(' ').slice(0, 1800);
};

const perform = async (z, bundle) => {
  const wineryId = validateWineryId(z, bundle.inputData.wineryId);
  const dryRun = isSwitchedOn(bundle.inputData.dryRun);
  const skipAlreadyRecorded = isSwitchedOn(bundle.inputData.skipAlreadyRecorded);
  const orderNumber = String(bundle.inputData.orderNumber || '').trim() || 'unknown';
  const effectiveAt = String(bundle.inputData.effectiveAt || '').trim();
  const skus = splitList(bundle.inputData.skus);
  const quantities = splitList(bundle.inputData.quantities);

  if (Number.isNaN(Date.parse(effectiveAt))) {
    throw new z.errors.Error(
        `"${effectiveAt.slice(0, 40)}" is not a date and time. Map the order's Processed At (or Created At) ` +
          'from the Shopify step.',
        'InvalidInput',
        400,
    );
  }
  if (!skus.length) {
    throw new z.errors.Error(
        'No line item SKUs came through. Map the Shopify step\'s Line Items Sku field.',
        'InvalidInput',
        400,
    );
  }
  if (skus.length !== quantities.length) {
    throw new z.errors.Error(
        `Got ${skus.length} SKU(s) but ${quantities.length} quantity(ies). They have to line up one to one, ` +
          'or the wrong number of bottles would be recorded, so nothing was recorded. Map Line Items Sku and ' +
          'Line Items Quantity from the same Shopify step.',
        'InvalidInput',
        400,
    );
  }

  const skipped = skipReason({
    financialStatus: bundle.inputData.financialStatus,
    cancelledAt: bundle.inputData.cancelledAt,
  });

  const output = {
    dryRun,
    orderNumber,
    effectiveAt,
    financialStatus: String(bundle.inputData.financialStatus || '').trim() || null,
    status: skipped || '',
    linesRecorded: 0,
    linesWouldRecord: 0,
    linesAlreadyRecorded: 0,
    linesWithProblems: 0,
    lines: [],
  };

  if (skipped) {
    z.console.log('Replay Shopify Orders result', JSON.stringify(output));
    return output;
  }

  const adjustments = buildAdjustments(skus, quantities);
  if (!adjustments.length) {
    output.status = 'no_case_goods';
    z.console.log('Replay Shopify Orders result', JSON.stringify(output));
    return output;
  }

  const matcher = createAdjustmentMatcher(z, wineryId);
  const lotIds = new Map();

  for (const {sku, bottles, valid} of adjustments) {
    const line = {
      orderNumber,
      sku,
      bottles,
      effectiveAt,
      lotId: null,
      result: '',
      referenceNumber: null,
      error: null,
    };
    output.lines.push(line);

    if (!isCaseGoodsSku(sku)) {
      line.result = 'invalid_sku';
      line.error = `"${sku.slice(0, 40)}" is not a usable case goods code.`;
      continue;
    }
    if (!valid || bottles <= 0) {
      line.result = 'invalid_quantity';
      line.error = `The quantity for ${sku} is not a whole number of bottles above zero.`;
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
        const existing = await matcher.find({lotId: line.lotId, compliance: COMPLIANCE, effectiveAt});
        if (existing && existing.match === 'exact') {
          line.result = 'already_recorded';
          line.referenceNumber = existing.adjustment.referenceNumber || null;
          continue;
        }
        if (existing && existing.match === 'possible') {
          line.result = 'possible_duplicate';
          line.referenceNumber = existing.adjustment.referenceNumber || null;
          line.error = `InnoVint already has an adjustment on this lot at ${existing.adjustment.effectiveAt}, ` +
            `close to this order's time (${effectiveAt}). Check it in InnoVint. If it belongs to a different ` +
            'order, run this order again with Skip Lines Already in InnoVint turned off.';
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
        effectiveAt,
      });
      line.result = 'recorded';
    } catch (error) {
      line.result = 'error';
      line.error = describeError(error);
    }
  }

  const countLines = (value) => output.lines.filter((line) => line.result === value).length;
  output.linesRecorded = countLines('recorded');
  output.linesWouldRecord = countLines('would_record');
  output.linesAlreadyRecorded = countLines('already_recorded');
  output.linesWithProblems = output.lines.filter((line) => PROBLEM_LINE_RESULTS.includes(line.result)).length;

  const outcomes = new Set(output.lines.map((line) => line.result));
  output.status = outcomes.size === 1 ? [...outcomes][0] : 'mixed';

  z.console.log('Replay Shopify Orders result', JSON.stringify(output));

  if (!dryRun && output.linesWithProblems) {
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
    label: 'Replay Shopify Order',
    description:
      'Records the bottled-wine removals for one paid Shopify order the Zap missed. Takes the order\'s line ' +
      'items from a Shopify step, skips anything already in InnoVint, and previews unless Dry Run is turned off.',
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
        key: 'orderNumber',
        label: 'Shopify Order Number',
        required: false,
        type: 'string',
        helpText: 'Only used for the report, e.g. #3495. Map the Shopify step\'s Name field.',
      },
      {
        key: 'effectiveAt',
        label: 'Effective Date and Time',
        required: true,
        type: 'string',
        helpText: 'Map the Shopify step\'s **Processed At** so the removal is dated when the order was paid, ' +
          'exactly like the live Zap.',
      },
      {
        key: 'skus',
        label: 'Line Item SKUs',
        required: true,
        type: 'string',
        helpText: 'Map the Shopify step\'s **Line Items Sku**. Only SKUs starting with CG- are recorded; ' +
          'tastings and merchandise are ignored.',
      },
      {
        key: 'quantities',
        label: 'Line Item Quantities',
        required: true,
        type: 'string',
        helpText: 'Map the Shopify step\'s **Line Items Quantity**, from the same step, so it lines up with ' +
          'the SKUs one to one.',
      },
      {
        key: 'financialStatus',
        label: 'Financial Status',
        required: false,
        type: 'string',
        helpText: 'Map the Shopify step\'s **Display Financial Status**. Anything other than PAID or ' +
          'PARTIALLY_REFUNDED is skipped rather than recorded.',
      },
      {
        key: 'cancelledAt',
        label: 'Cancelled At',
        required: false,
        type: 'string',
        helpText: 'Map the Shopify step\'s **Cancelled At**. A cancelled order is skipped.',
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
          'Yes skips a line when InnoVint already has the same removal at the order\'s time, and flags ' +
          'anything recorded within two minutes of it for you to check. Leave this on.',
      },
    ],
    outputFields: [
      {key: 'dryRun', label: 'Dry Run', type: 'boolean'},
      {key: 'orderNumber', label: 'Order Number', type: 'string'},
      {key: 'effectiveAt', label: 'Effective Date and Time', type: 'string'},
      {key: 'status', label: 'Status', type: 'string'},
      {key: 'linesRecorded', label: 'Lines Recorded', type: 'integer'},
      {key: 'linesWouldRecord', label: 'Lines That Would Be Recorded', type: 'integer'},
      {key: 'linesAlreadyRecorded', label: 'Lines Already Recorded', type: 'integer'},
      {key: 'linesWithProblems', label: 'Lines With Problems', type: 'integer'},
      {key: 'lines[]sku', label: 'Line SKU', type: 'string'},
      {key: 'lines[]bottles', label: 'Line Bottles', type: 'integer'},
      {key: 'lines[]result', label: 'Line Result', type: 'string'},
      {key: 'lines[]lotId', label: 'Line Lot ID', type: 'string'},
      {key: 'lines[]referenceNumber', label: 'Line Reference Number', type: 'string'},
      {key: 'lines[]error', label: 'Line Problem', type: 'string'},
    ],
    sample: {
      dryRun: true,
      orderNumber: '#3499',
      effectiveAt: '2026-04-04T20:07:53Z',
      financialStatus: 'PAID',
      status: 'would_record',
      linesRecorded: 0,
      linesWouldRecord: 1,
      linesAlreadyRecorded: 0,
      linesWithProblems: 0,
      lines: [{
        orderNumber: '#3499',
        sku: 'CG-B1700RCVMER',
        bottles: 2,
        effectiveAt: '2026-04-04T20:07:53Z',
        lotId: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y',
        result: 'would_record',
        referenceNumber: null,
        error: null,
      }],
    },
  },
};
