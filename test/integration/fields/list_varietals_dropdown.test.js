const zapier = require('zapier-platform-core');
const should = require('should');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');
/**
 * Create a tester instance for the specified Zapier App.
 *
 * @param {object} App - The Zapier App object to create the tester for.
 * @returns {object} The appTester instance for testing the Zapier App.
 */
describe('List Varietals Dropdown Integration Test', function() {
  // this.timeout(20000); // Increase the timeout to 20 seconds

  zapier.tools.env.inject();

  it('should load varietals data directly from the API with pagination',
      async () => {
        const results =
        await appTester(
            App.triggers.listVarietalsDropdown.operation.perform, bundle,
        );

        // Since we're hitting the actual API, we can't predict the exact
        // content of the data. So we'll check for the structure and types
        // instead.
        should(results).be.an.Array().and.not.empty();
        results.forEach((varietal) => {
          varietal.should.have.property('id').which.is.a.String();
          varietal.should.have.property('name').which.is.a.String();
        });

        // If you know there should be a specific number of items or specific
        // content, you can add those checks as well.
        // For example, if you know there should be more than 10 appellations:
        should(results.length).be.aboveOrEqual(940);
      });
});
