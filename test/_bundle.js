const bundle = {
  authData: {
    apiKey: process.env.TEST_API_KEY || '',
  },
  inputData: {
    wineryId: '123', // Common winery ID for tests
    caseGoodsName: 'CG-2200RCVTOUROSE', // Common case goods name for tests
  },
  baseUrl: 'https://sutter.innovint.us', // Base URL for API
};

module.exports = {bundle};
