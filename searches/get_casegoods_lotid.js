'use strict';

const {findLotIdByCode, validateWineryId} = require('../lib/innovint');

/**
 * Finds the lot whose code is exactly the case goods name given.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} bundle - The Zapier bundle object.
 * @return {Promise<{id: string}[]>} The lot id, or an empty array when no lot has that code.
 */
const getCaseGoodsLotId = async (z, bundle) => {
  const wineryId = validateWineryId(z, bundle.inputData.wineryId);
  const code = String(bundle.inputData.caseGoodsName || '').trim();

  if (!code) {
    throw new z.errors.Error('Enter a case goods name.', 'InvalidInput', 400);
  }

  const lotId = await findLotIdByCode(z, wineryId, code);
  return lotId ? [{id: lotId}] : [];
};

module.exports = {
  key: 'getCaseGoodsLotId',
  noun: 'Lot ID',
  display: {
    label: 'Get Lot By Case Goods Name',
    description: 'Gets a lot ID from an exact case goods lot code.',
  },
  operation: {
    perform: getCaseGoodsLotId,
    inputFields: [
      {
        key: 'wineryId',
        required: true,
        type: 'string',
        dynamic: 'listWineriesDropdown.id.name',
      },
      {
        key: 'caseGoodsName',
        required: true,
        type: 'string',
        helpText: 'The lot code exactly as it appears in InnoVint, for example CG-B1700RCVMER.',
      },
    ],
    outputFields: [
      {key: 'id', label: 'Lot ID', type: 'string'},
    ],
    sample: {id: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y'},
  },
};
