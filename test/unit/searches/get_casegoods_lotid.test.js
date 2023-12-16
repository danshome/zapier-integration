const zapier = require('zapier-platform-core');
const nock = require('nock');
const should = require('should');
const App = require('../../../index'); // Adjust this path as necessary
/**
 * Creates a testing instance for the specified Zapier app.
 *
 * @param {Object} App - The Zapier app object.
 * @returns {Object} - The testing instance for the app.
 */
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');

describe('getCaseGoodsLotId', function() {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should handle HTTP errors', async () => {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(400, {});

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform, bundle);
      should.fail('No error', 'Error', 'No error was thrown', 'should.fail');
    } catch (error) {
      const errorObject = JSON.parse(error.message);
      should(errorObject.status).be.equal(400);
    }
  });

  it('should fetch the correct Lot ID', async () => {
    const lotIdResponse = {
      results: [{data: {id: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y'}}], // Mock response structure
    };

    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(200, lotIdResponse);

    const result = await appTester(
        App.searches.getCaseGoodsLotId.operation.perform, bundle);
    should(result[0]).have.property('id', 'lot_Z1LPW8OQMY23L6QM3KXJD45Y'); // Check the first element of the array
  });

  it('should throw an error if no lot is found', async () => {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(200,
            {results: [], pagination: {count: 0, next: null, previous: null}});

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform, bundle);
      should.fail('No error', 'Error', 'No error was thrown', 'should.fail');
    } catch (error) {
      error.message.should.containEql(
          'No lot found with the provided name, or the data structure is unexpected.');
    }
  });

  it('should handle HTTP 400 Bad Request errors', async () => {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(400, {
          errors: [{details: 'Invalid input data'}],
        });

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform, bundle);
      should.fail('No error', 'Error', 'No error was thrown', 'should.fail');
    } catch (error) {
      try {
        const errorContent = JSON.parse(error.message).content;
        const errorObject = JSON.parse(errorContent);
        should.exist(errorObject); // Ensure errorObject is not null or undefined
        should(errorObject.errors[0].details).be.equal('Invalid input data');
      } catch (parseError) {
        should.fail('Error parsing JSON response', 'Error', parseError.message,
            'should.fail');
      }
    }
  });

  it('should handle HTTP 500 Internal Server Error', async () => {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(500, {
          errors: [{details: 'Internal server error'}],
        });

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform, bundle);
      should.fail('No error', 'Error', 'No error was thrown', 'should.fail');
    } catch (error) {
      try {
        const errorContent = JSON.parse(error.message).content;
        const errorObject = JSON.parse(errorContent);
        should.exist(errorObject); // Ensure errorObject is not null or undefined
        should(errorObject.errors[0].details).be.equal('Internal server error');
      } catch (parseError) {
        should.fail('Error parsing JSON response', 'Error', parseError.message,
            'should.fail');
      }
    }
  });

  it('should handle invalid JSON responses', async () => {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query(true)
        .reply(200, 'This is not JSON');

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform, bundle);
      should.fail('No error', 'Error', 'Expected an invalid JSON error',
          'should.fail');
    } catch (error) {
      should(error.message).containEql('Invalid JSON response');
    }
  });

  it('should handle invalid input data', async function() {
    // Modify the bundle to simulate invalid input
    const invalidBundle = {
      ...bundle,
      inputData: {
        wineryId: 'invalid-id',
        caseGoodsName: 'InvalidName',
      },
    };

    try {
      await appTester(App.searches.getCaseGoodsLotId.operation.perform,
          invalidBundle);
      should.fail('No error', 'Error', 'Expected an invalid input error',
          'should.fail');
    } catch (error) {
      should(error.message).containEql('Innovint server error!');
    }
  });
});
