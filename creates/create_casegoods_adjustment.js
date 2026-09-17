'use strict';

const {
  COMPLIANCE_CHOICES,
  createAdjustmentMatcher,
  createCaseGoodsAdjustment,
  findLotIdByCode,
  validateWineryId,
} = require('../lib/innovint');
const {describeError} = require('../lib/errors');

const splitList = (value) => String(value === undefined || value === null ? '' : value).split(',').map((item) =>
  item.trim());

/**
 * Records one case goods adjustment per case goods name.
 *
 * Every lot is looked up before anything is recorded, so a name that does not
 * match a lot cannot leave an order half recorded. Lines InnoVint already has
 * at the same effective time are skipped, which makes a replayed Zap run safe.
 *
 * An adjustment on the same lot at a nearby but different time is a different
 * order (two sales of one wine minutes apart), so it is recorded and noted in
 * the log rather than skipped. Use the Replay Shopify Orders action, which
 * flags those for review, when catching up by hand.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} bundle - The Zapier bundle object.
 * @return {Promise<{referenceNumbers: string[], alreadyRecorded: string[], skippedNames: string[]}>} What happened.
 */
const perform = async (z, bundle) => {
  const wineryId = validateWineryId(z, bundle.inputData.wineryId);
  const compliance = bundle.inputData.compliance;
  const effectiveAt = bundle.inputData.effectiveAt;
  const names = splitList(bundle.inputData.caseGoodsNames);
  const quantities = splitList(bundle.inputData.bottleQuantities);

  if (!COMPLIANCE_CHOICES[compliance]) {
    throw new z.errors.Error(
        `"${String(compliance).slice(0, 40)}" is not an InnoVint compliance type.`, 'InvalidInput', 400);
  }
  if (Number.isNaN(Date.parse(effectiveAt))) {
    throw new z.errors.Error(
        `"${String(effectiveAt).slice(0, 40)}" is not a date and time.`, 'InvalidInput', 400);
  }
  if (names.length !== quantities.length) {
    throw new z.errors.Error(
        `Got ${names.length} case goods name(s) but ${quantities.length} bottle quantity(ies). They have to ` +
          'line up one to one, or the wrong number of bottles would be recorded, so nothing was recorded. ' +
          'Check how the Zap maps the line item SKUs and quantities, then use the Replay Shopify Orders ' +
          'action to record this order.',
        'InvalidInput',
        400,
    );
  }

  const wanted = [];
  const skippedNames = [];
  names.forEach((name, index) => {
    if (!name.startsWith('CG-')) {
      skippedNames.push(name);
      return;
    }
    const bottles = Number(quantities[index]);
    if (!Number.isInteger(bottles) || bottles <= 0) {
      throw new z.errors.Error(
          `"${String(quantities[index]).slice(0, 20)}" is not a bottle quantity for ${name}. Nothing was recorded.`,
          'InvalidInput',
          400,
      );
    }
    wanted.push({name, bottles});
  });

  // Resolve every lot first: all or nothing.
  const missing = [];
  for (const line of wanted) {
    line.lotId = await findLotIdByCode(z, wineryId, line.name);
    if (!line.lotId) {
      missing.push(line.name);
    }
  }
  if (missing.length) {
    throw new z.errors.Error(
        `No InnoVint lot has the code ${missing.join(', ')}. Nothing was recorded. Check the SKU in Shopify ` +
          'against the lot code in InnoVint.',
        'LotNotFound',
        400,
    );
  }

  const matcher = createAdjustmentMatcher(z, wineryId);
  const referenceNumbers = [];
  const alreadyRecorded = [];

  for (const line of wanted) {
    // The check only exists to stop a repeated Zap run recording the same thing
    // twice. If it cannot finish, record anyway: a missing removal is worse.
    let existing = null;
    try {
      existing = await matcher.find({lotId: line.lotId, compliance, effectiveAt});
    } catch (error) {
      z.console.log(`Could not check InnoVint for an existing ${line.name} adjustment, recording it anyway: ` +
        describeError(error));
    }
    if (existing && existing.match === 'exact') {
      z.console.log(`${line.name} is already recorded in InnoVint at ${effectiveAt}; skipping it.`);
      alreadyRecorded.push(existing.adjustment.referenceNumber);
      continue;
    }
    if (existing && existing.match === 'possible') {
      z.console.log(`${line.name} has a nearby adjustment (${existing.adjustment.referenceNumber} at ` +
        `${existing.adjustment.effectiveAt}). Recording this one as well, because it is a different order.`);
    }

    try {
      referenceNumbers.push(await createCaseGoodsAdjustment(z, {
        wineryId,
        lotId: line.lotId,
        bottles: line.bottles,
        compliance,
        effectiveAt,
      }));
    } catch (error) {
      throw new z.errors.Error(
          `Recorded ${referenceNumbers.length} of ${wanted.length} line(s) before ${line.name} failed: ` +
            `${describeError(error)}. Running this again skips what is already recorded.`,
          'InnoVintError',
          400,
      );
    }
  }

  z.console.log('Recorded reference numbers', JSON.stringify(referenceNumbers));
  return {referenceNumbers, alreadyRecorded, skippedNames};
};

module.exports = {
  key: 'createCaseGoodsAdjustment',
  noun: 'Case Goods Adjustment',
  display: {
    label: 'Case Goods Adjustment',
    description: 'Performs a Case Goods Adjustment.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'wineryId',
        required: true,
        type: 'string',
        dynamic: 'listWineriesDropdown.id.name',
      },
      {
        key: 'caseGoodsNames',
        required: true,
        type: 'string',
        helpText: 'Comma-separated list of Case Goods Names. Names that do not start with CG- are ignored, ' +
            'but they still need a matching entry in the quantity list.',
      },
      {
        key: 'bottleQuantities',
        required: true,
        type: 'string',
        helpText: 'Comma-separated list of quantities corresponding to each Case Goods Name',
      },
      {
        key: 'compliance',
        required: true,
        type: 'string',
        helpText: 'Compliance information for the adjustment',
        default: COMPLIANCE_CHOICES.REMOVED_TAXPAID,
        choices: COMPLIANCE_CHOICES,
      },
      {
        key: 'effectiveAt',
        required: true,
        type: 'datetime',
        helpText: 'The effective date and time for the adjustment',
      },
    ],
    outputFields: [
      {key: 'referenceNumbers[]', label: 'Reference Numbers', type: 'string'},
      {key: 'alreadyRecorded[]', label: 'Already Recorded Reference Numbers', type: 'string'},
      {key: 'skippedNames[]', label: 'Ignored Names', type: 'string'},
    ],
    sample: {
      referenceNumbers: ['example_ref_number1', 'example_ref_number2'],
      alreadyRecorded: [],
      skippedNames: ['Private Wine Tasting'],
    },
  },
};
