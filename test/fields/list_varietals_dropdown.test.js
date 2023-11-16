const zapier = require('zapier-platform-core');
const nock = require('nock');
const App = require('../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../_bundle');
const listVarietals = require('../../fields/list_varietals_dropdown');

describe('List Varietals Trigger', () => {
  zapier.tools.env.inject();

  it('should load varietals data', async () => {
    nock('https://sutter.innovint.us')
        .get('/api/v1/varietals')
        .reply(200, [
          {id: 'vari_LZ4E0PWYDM8X8LGX6R92JK51', name: 'Acolon'},
          {id: 'vari_9P2VQ0D3NK7LZMZ6WROJ81E4', name: 'Agawam'},
        ]);

    const results = await appTester(listVarietals.operation.perform, bundle);

    results.should.containDeep(
        [{id: 'vari_LZ4E0PWYDM8X8LGX6R92JK51', name: 'Acolon'}]);
    results.should.containDeep(
        [{id: 'vari_9P2VQ0D3NK7LZMZ6WROJ81E4', name: 'Agawam'}]);
  });
});
