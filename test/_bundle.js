'use strict';

const bundle = {
  authData: {
    apiKey: process.env.TEST_API_KEY || '',
  },
  inputData: {
    wineryId: process.env.TEST_WINERYID || '',
    caseGoodsNames: process.env.TEST_CASEGOODSNAMES || '',
    bottleQuantities: process.env.TEST_BOTTLEQUANTITIES || '',
    compliance: process.env.TEST_COMPLIANCE || 'REMOVED_TAXPAID',
    // Default to now, so a repeated run is a new adjustment rather than one
    // the duplicate check skips.
    effectiveAt: process.env.TEST_EFFECTIVEAT || new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  },
  baseUrl: process.env.TEST_BASEURL || 'https://sutter.innovint.us',
};

module.exports = {bundle};
