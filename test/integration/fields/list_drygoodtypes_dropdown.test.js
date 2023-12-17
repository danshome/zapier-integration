const zapier = require('zapier-platform-core');
const should = require('should'); // Ensure 'should' is installed for assertions
const App = require('../../../index'); // The path to your Zapier app
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');

describe('List Dry Goods Dropdown Integration Test', function() {
  // this.timeout(20000); // Increase the timeout to 20 seconds

  zapier.tools.env.inject();

  it('should load dry goods types data directly from the API with pagination',
      async () => {
        const results =
            await appTester(
                App.triggers.listDryGoodTypesDropdown.operation.perform, bundle,
            );

        // Since we're hitting the actual API, we can't predict the exact
        // content of the data. So we'll check for the structure and types
        // instead.
        should(results).be.an.Array().and.not.empty();
        results.forEach((drygoodtype) => {
          drygoodtype.should.have.property('id').which.is.a.String();
          drygoodtype.should.have.property('name').which.is.a.String();
        });

        // If you know there should be a specific number of items or specific
        // content, you can add those checks as well.
        // For example, if you know there should be more than 10 appellations:
        should(results.length).be.aboveOrEqual(15);
      });
});
