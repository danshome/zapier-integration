const zapier = require('zapier-platform-core');
const nock = require('nock');
const App = require('../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../_bundle');
const listAppellations = require('../../fields/list_appellations_dropdown');

describe('List Appellations Trigger', () => {
  zapier.tools.env.inject();

  it('should load appellation data', async () => {
    nock('https://sutter.innovint.us')
        .get('/api/v1/appellations')
        .reply(200, [
          {id: '1', name: 'Napa Valley'},
          {id: '2', name: 'Sonoma Coast'},
        ]);

    const results = await appTester(listAppellations.operation.perform, bundle);

    results.should.containDeep([{id: '1', name: 'Napa Valley'}]);
    results.should.containDeep([{id: '2', name: 'Sonoma Coast'}]);
  });
});
