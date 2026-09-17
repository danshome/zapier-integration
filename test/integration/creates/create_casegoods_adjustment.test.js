'use strict';

const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');
const {bundle} = require('../../_bundle');

const appTester = zapier.createAppTester(App);

// This test records a real adjustment in InnoVint. It only runs against a test
// winery you opt into, so a normal test run can never touch production data.
describe('createCaseGoodsAdjustment Integration Test', function() {
  this.timeout(60000);

  beforeEach(function() {
    if (process.env.INNOVINT_ALLOW_TEST_WRITES !== 'yes' || !process.env.TEST_WINERYID) {
      this.skip();
    }
  });

  it('should create case goods adjustment successfully', async () => {
    const result = await appTester(App.creates.createCaseGoodsAdjustment.operation.perform, bundle);

    should.exist(result.referenceNumbers);
    result.referenceNumbers.should.be.an.Array();
    result.alreadyRecorded.should.be.an.Array();
  });
});
