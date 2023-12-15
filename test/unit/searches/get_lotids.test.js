const nock = require('nock');
const should = require('should');
const {operation} = require('../../../searches/get_lotid');
const perform = operation.perform;
const {bundle} = require('../../_bundle');

describe('getLotId', function() {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should handle HTTP errors', async function() {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query({
          limit: 1,
          q: bundle.inputData.caseGoodsName,
        })
        .reply(400);

    const z = {
      request: () => Promise.resolve({
        status: 400,
        throwForStatus: function() {
          if (this.status < 200 || this.status >= 300) {
            throw new Error(`Request failed with status ${this.status}`);
          }
        },
      }),
    };

    try {
      await perform(z, bundle);
      should.fail('No error', 'Error', 'No error was thrown', 'should.fail');
    } catch (error) {
      should(error.message).be.equal('Request failed with status 400');
    }
  });

  it('should fetch the correct Lot ID', async function() {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query({
          limit: 1,
          q: bundle.inputData.caseGoodsName,
        })
        .reply(200, {
          'results': [
            {
              'data': {
                'id': 'lot_Z1LPW8OQMY23L6QM3KXJD45Y',
                'internalId': 13562193,
                'access': {
                  'globalAccess': false,
                  'ownerTags': [],
                },
                'archived': false,
                'bondId': 'bond_OKQZLPJD5MZRVP789VYEW204',
                'bottlesOnHand': {
                  'cases': 14.0,
                  'bottles': 8.0,
                },
                'code': 'CG-2200RCVTOUROSE',
                'color': 'rose',
                'expectedYield': 0.0,
                'fruitWeight': {
                  'value': 0.0,
                  'unit': 'tons',
                },
                'lotStyle': 'STILL',
                'lotType': 'CASE_GOODS',
                'name': '2022 Robert Clay Vineyards Touriga Nacional Rose',
                'stage': 'TAXPAID',
                'tags': [
                  'ROBERT CLAY VINEYARDS',
                  'ROSE',
                ],
                'taxClass': 'TC_LESS_THAN_16',
                'volume': {
                  'value': 34.87044000000001,
                  'unit': 'gal',
                },
                'weight': {
                  'value': 0.0,
                  'unit': 'tons',
                },
              },
              'relationships': {
                /* eslint-disable max-len */
                'bond': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/bonds/bond_OKQZLPJD5MZRVP789VYEW204',
                'blockComponents': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots/lot_Z1LPW8OQMY23L6QM3KXJD45Y/blockComponents',
                'juiceMakeup': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots/lot_Z1LPW8OQMY23L6QM3KXJD45Y/componentsSummary',
                'vessels': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/vessels?lot=lot_Z1LPW8OQMY23L6QM3KXJD45Y',
                /* eslint-enable max-len */
              },
            },
          ],
          'pagination': {
            'count': 2,
            /* eslint-disable max-len */
            'next': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots?limit=1&offset=1&q=CG-2200RCVTOUROSE',
            /* eslint-enable max-len */
            'previous': null,
          },
        });

    const z = {
      request: () => Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          'results': [
            {
              'data': {
                'id': 'lot_Z1LPW8OQMY23L6QM3KXJD45Y',
                'internalId': 13562193,
                'access': {
                  'globalAccess': false,
                  'ownerTags': [],
                },
                'archived': false,
                'bondId': 'bond_OKQZLPJD5MZRVP789VYEW204',
                'bottlesOnHand': {
                  'cases': 14.0,
                  'bottles': 8.0,
                },
                'code': 'CG-2200RCVTOUROSE',
                'color': 'rose',
                'expectedYield': 0.0,
                'fruitWeight': {
                  'value': 0.0,
                  'unit': 'tons',
                },
                'lotStyle': 'STILL',
                'lotType': 'CASE_GOODS',
                'name': '2022 Robert Clay Vineyards Touriga Nacional Rose',
                'stage': 'TAXPAID',
                'tags': [
                  'ROBERT CLAY VINEYARDS',
                  'ROSE',
                ],
                'taxClass': 'TC_LESS_THAN_16',
                'volume': {
                  'value': 34.87044000000001,
                  'unit': 'gal',
                },
                'weight': {
                  'value': 0.0,
                  'unit': 'tons',
                },
              },
              'relationships': {
                /* eslint-disable max-len */
                'bond': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/bonds/bond_OKQZLPJD5MZRVP789VYEW204',
                'blockComponents': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots/lot_Z1LPW8OQMY23L6QM3KXJD45Y/blockComponents',
                'juiceMakeup': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots/lot_Z1LPW8OQMY23L6QM3KXJD45Y/componentsSummary',
                'vessels': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/vessels?lot=lot_Z1LPW8OQMY23L6QM3KXJD45Y',
                /* eslint-enable max-len */
              },
            },
          ],
          'pagination': {
            'count': 2,
            /* eslint-disable max-len */
            'next': 'https://sutter.innovint.us/api/v1/wineries/wnry_JEW56RPYO7JWR59GVXK8QDZ3/lots?limit=1&offset=1&q=CG-2200RCVTOUROSE',
            /* eslint-enable max-len */
            'previous': null,
          },
        }),
        throwForStatus: function() {
          if (this.status < 200 || this.status >= 300) {
            throw new Error(`Request failed with status ${this.status}`);
          }
        },
      }),
    };

    try {
      const result = await perform(z, bundle);
      should(result).have.property('id', 'lot_Z1LPW8OQMY23L6QM3KXJD45Y');
    } catch (error) {
      should.fail('Unexpected error', 'No error', error.message, 'should.fail');
    }
  });

  it('should throw an error if no lot is found', async function() {
    nock(bundle.baseUrl)
        .get(`/api/v1/wineries/${bundle.inputData.wineryId}/lots`)
        .query({
          limit: 1,
          q: 'NonExistentCaseGood',
        })
        .reply(200, {
          results: [],
          pagination: {
            count: 0,
            next: null,
            previous: null,
          },
        });

    bundle.inputData.caseGoodsName = 'NonExistentCaseGood';

    const z = {
      request: () => Promise.resolve({
        status: 200,
        json: () => Promise.resolve(
            {results: [], pagination: {count: 0, next: null, previous: null}}),
        throwForStatus: function() {
          if (this.status < 200 || this.status >= 300) {
            throw new Error(`Request failed with status ${this.status}`);
          }
        },
      }),
    };

    try {
      await perform(z, bundle);
      should.fail('No error', 'Error', 'No error was thrown',
          'should.fail');
    } catch (error) {
      should(error.message).be.equal(
          'No lot found with the provided name, ' +
          'or the data structure is unexpected.');
    }
  });
});
