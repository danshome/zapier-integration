const zapier = require('zapier-platform-core');
const nock = require('nock');
const should = require('should');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');

describe('List Appellations Dropdown UnitTest', () => {
  zapier.tools.env.inject();

  it('should load appellation data with pagination', async () => {
    // Mock the first page
    nock('https://sutter.innovint.us')
        .get('/api/v1/appellations')
        .reply(200, {
          'results': [
            {
              'data': {
                'id': 'appl_9P2VQ0D3NK7LZMZ6WROJ81E4',
                'internalId': 1,
                'name': 'Adelaida District',
              },
              'relationships': {
                'source': 5,
              },
            },
            {
              'data': {
                'id': 'appl_OKQZLPJD5MZYNKG89VYEW204',
                'internalId': 1655,
                'name': 'Adelaide',
              },
              'relationships': {
                'source': 5,
              },
            },
          ],
          'pagination': {
            'count': 785,
            'next': 'https://sutter.innovint.us/api/v1/appellations?limit=2&offset=2',
            'previous': null,
          },
        });

    // Mock the second page
    nock('https://sutter.innovint.us')
        .get('/api/v1/appellations?limit=2&offset=2')
        .reply(200, {
          'results': [
            {
              'data': {
                'id': 'appl_W3LR54YPX0MD9P79VO61ZQ2N',
                'internalId': 323,
                'name': 'Adelaide Hills',
              },
              'relationships': {
                'source': 5,
              },
            },
            {
              'data': {
                'id': 'appl_93REZ41OQWGW5Y78KL26D05P',
                'internalId': 327,
                'name': 'Adelaide Plains',
              },
              'relationships': {
                'source': 5,
              },
            },
          ],
          'pagination': {
            'count': 785,
            'next': null,
            'previous': 'https://sutter.innovint.us/api/v1/appellations?limit=2',
          },
        });

    const results =
        await appTester(
            App.triggers.listAppellationsDropdown.operation.perform,
            bundle,
        );

    // Assertions
    // Check that there are more than 2 items, indicating pagination was handled
    should(results.length).above(2);
    should(results).containDeep([
      {id: 'appl_9P2VQ0D3NK7LZMZ6WROJ81E4', name: 'Adelaida District'}]);
    should(results).containDeep([
      {id: 'appl_OKQZLPJD5MZYNKG89VYEW204', name: 'Adelaide'}]);
    should(results).containDeep([
      {id: 'appl_W3LR54YPX0MD9P79VO61ZQ2N', name: 'Adelaide Hills'}]);
    should(results).containDeep([
      {id: 'appl_93REZ41OQWGW5Y78KL26D05P', name: 'Adelaide Plains'}]);
  });
});
