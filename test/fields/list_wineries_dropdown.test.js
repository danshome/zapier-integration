const zapier = require('zapier-platform-core');
const nock = require('nock');
const App = require("../../index");
const appTester = zapier.createAppTester(App);
const {bundle} = require('../_bundle');
const listWineries = require("../../fields/list_wineries_dropdown");


describe('List Wineries Trigger', () => {
  // Use this to mock environment variables
  zapier.tools.env.inject();

  it('should correctly handle pagination when loading wineries', async () => {
    // Mock the first page
    nock('https://sutter.innovint.us')
    .get('/api/v1/wineries')
    .reply(200, {
      pagination: {
        next: "https://sutter.innovint.us/api/v1/wineries/next",
      },
      results: [
        { data: { internalId: 1, id: "string1", name: "Winery 1" } }
        // Additional results for page 1...
      ]
    });

    // Mock the second (next) page
    nock('https://sutter.innovint.us')
    .get('/api/v1/wineries/next')
    .reply(200, {
      pagination: {
        next: null,
      },
      results: [
        { data: { internalId: 3, id: "string3", name: "Winery 3" } }
        // Additional results for page 2...
      ]
    });

    const results = await appTester(listWineries.operation.perform, bundle);

    // Check if results include items from all pages using should
    // Ensure results contain data from both the first and second page
    results.should.containEql({ id: '1' });
    results.should.containEql({ id: '3' });
    // Additional assertions as needed...
  });

});
