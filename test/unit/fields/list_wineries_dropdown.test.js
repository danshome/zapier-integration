const should = require('should');
const zapier = require('zapier-platform-core');
const nock = require('nock');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');
const listWineriesDropdown = require('../../../fields/list_wineries_dropdown');

describe('List Wineries Trigger', () => {
  zapier.tools.env.inject();

  it('should correctly handle pagination when loading wineries', async () => {
    // Mock the first page
    nock('https://sutter.innovint.us')
        .get('/api/v1/wineries')
        .reply(200, {
          results: [
            {
              data: {id: 'wnry_1', internalId: 1001, name: 'Winery One'},
              // ... other properties
            },
            {
              data: {id: 'wnry_2', internalId: 1002, name: 'Winery Two'},
              // ... other properties
            },
          ],
          pagination: {
            next: 'https://sutter.innovint.us/api/v1/wineries?page=2',
          },
        });

    // Mock the second page
    nock('https://sutter.innovint.us')
        .get('/api/v1/wineries?page=2')
        .reply(200, {
          results: [
            {
              data: {id: 'wnry_3', internalId: 1003, name: 'Winery Three'},
              // ... other properties
            },
            {
              data: {id: 'wnry_4', internalId: 1004, name: 'Winery Four'},
              // ... other properties
            },
          ],
          pagination: {
            next: null,
          },
        });

    const results = await appTester(listWineriesDropdown.operation.perform,
        bundle);

    // Check if results include items from all pages
    should(results).have.length(4);
    results.forEach((result) => {
      should(result).have.property('id'); // Check for label instead of id
      should(result).have.property('name'); // Check for value instead of id
    });
  });
});
