const zapier = require('zapier-platform-core');
const nock = require('nock');
const should = require('should');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');
const listDryGoodTypes = require('../../../fields/list_drygoodtypes_dropdown');

describe('List Dry Goods Trigger', () => {
  zapier.tools.env.inject();

  it('should load dry good types data', async () => {
    nock('https://sutter.innovint.us')
        .get('/api/v1/dryGoodTypes')
        .reply(200, {
          'results': [
            {
              'data': {
                'id': 'dgt_9P2VQ0D3NK7LZMZ6WROJ81E4',
                'name': 'Acid',
                'category': 'Additive',
                'units': {
                  'all': [
                    'L',
                    'mL',
                    'gal',
                    'dL',
                    'hL',
                    'kgal',
                    'g',
                    'mg',
                    'lb',
                    'kg',
                    'ton',
                  ],
                  'liquid': [
                    'L',
                    'mL',
                    'gal',
                    'dL',
                    'hL',
                    'kgal',
                  ],
                  'dry': [
                    'g',
                    'mg',
                    'lb',
                    'kg',
                    'ton',
                  ],
                },
              },
              'relationships': {},
            },
            {
              'data': {
                'id': 'dgt_1JEW56RPYO7JRMVXK8QDZ3L9',
                'name': 'Boxes',
                'category': 'Packaging',
                'units': {
                  'all': [
                    'boxes',
                    'inserts',
                  ],
                  'inventory': [
                    'packs',
                    'pallets',
                  ],
                },
              },
              'relationships': {},
            },
          ],
          'pagination': {
            'count': 15,
            'next': null,
            'previous': 'https://sutter.innovint.us/api/v1/dryGoodTypes',
          },
        },
        );

    const results = await appTester(listDryGoodTypes.operation.perform, bundle);

    const expectedFirstResult = {
      id: 'dgt_9P2VQ0D3NK7LZMZ6WROJ81E4',
      name: 'Acid',
      category: 'Additive',
      units: {
        all:
            ['L', 'mL', 'gal', 'dL', 'hL', 'kgal', 'g', 'mg', 'lb', 'kg', 'ton',
            ],
        liquid: ['L', 'mL', 'gal', 'dL', 'hL', 'kgal'],
        dry: ['g', 'mg', 'lb', 'kg', 'ton'],
      },
    };

    const expectedSecondResult = {
      id: 'dgt_1JEW56RPYO7JRMVXK8QDZ3L9',
      name: 'Boxes',
      category: 'Packaging',
      units: {
        all: ['boxes', 'inserts'],
        liquid: [],
        dry: [],
      },
    };

    should(results).containDeep([expectedFirstResult, expectedSecondResult]);
  });
});
