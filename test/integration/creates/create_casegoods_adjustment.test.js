const zapier = require('zapier-platform-core');
const should = require('should');
const App = require('../../../index'); // Adjust this path as necessary
const {bundle} = require('../../_bundle'); // Import the bundle from _bundle.js

const appTester = zapier.createAppTester(App);

describe('createCaseGoodsAdjustment Integration Test', function() {
  this.timeout(10000); // Set timeout to 10000ms (10 seconds)

  it('should create case goods adjustment successfully', async () => {
    // Assuming the bundle from _bundle.js has all the necessary inputData
    const result = await appTester(
        App.creates.createCaseGoodsAdjustment.operation.perform, bundle);

    should.exist(result.referenceNumbers);
    result.referenceNumbers.should.be.an.Array();
    // Add more specific assertions based on expected outcomes
  });

  // Additional test cases as needed...
});
