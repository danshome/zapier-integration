const zapier = require('zapier-platform-core');
const nock = require('nock');
const should = require('should');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');
const listVarietals = require('../../../fields/list_varietals_dropdown');

describe('List Varietals Trigger', () => {
  zapier.tools.env.inject();

  it('should load varietals data', async () => {
    nock('https://sutter.innovint.us')
        .get('/api/v1/varietals')
        .reply(200, {
          'results': [
            {
              'data': {
                'id': 'vari_LZ4E0PWYDM8X8LGX6R92JK51',
                'internalId': 689,
                'color': 'red',
                'name': 'Acolon',
              },
              'relationships': {
                'source': 5,
              },
            },
            {
              'data': {
                'id': 'vari_9P2VQ0D3NK7LZMZ6WROJ81E4',
                'internalId': 1,
                'color': 'red',
                'name': 'Agawam',
              },
              'relationships': {
                'source': 5,
              },
            },
          ],
          'pagination': {
            'count': 940,
            'next': null,
            'previous': 'https://sutter.innovint.us/api/v1/varietals?limit',
          },
        });

    const results = await appTester(listVarietals.operation.perform, bundle);

    should(results).containDeep(
        [{id: 'vari_LZ4E0PWYDM8X8LGX6R92JK51', name: 'Acolon'}]);
    should(results).containDeep(
        [{id: 'vari_9P2VQ0D3NK7LZMZ6WROJ81E4', name: 'Agawam'}]);
  });
});
