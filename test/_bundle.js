const bundle = {
  authData: {
    apiKey: process.env.TEST_API_KEY || '',
  },
  inputData: {
    wineryId: process.env.TEST_WINERYID || '',
    caseGoodsNames: process.env.TEST_CASEGOODSNAMES || '',
    bottleQuantities: process.env.TEST_BOTTLEQUANTITIES || '',
    compliance: process.env.TEST_COMPLIANCE || '',
    effectiveAt: process.env.TEST_EFFECTIVEAT || '',
  },
  baseUrl: process.env.TEST_BASEURL || '', // Base URL for API
};

module.exports = {bundle};
