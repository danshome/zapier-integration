const should = require('should');
const {bundle} = require('../_bundle');
const zapier = require('zapier-platform-core');

zapier.tools.env.inject();

const App = require('../../index');
const appTester = zapier.createAppTester(App);

describe('Authentication tests', () => {
  it('should authenticate successfully with valid credentials', async () => {
    // Use the bundle as is, assuming TEST_API_KEY is set correctly
    const body = await appTester(App.authentication.test, bundle);

    // The test returns the parsed body, which connectionLabel names the
    // connection from.
    should(body.results).be.an.Array().and.not.empty();
    should(App.authentication.connectionLabel(null, {inputData: body})).be.a.String().and.not.empty();
  });

  it('should fail authentication with invalid credentials', async () => {
    const invalidBundle = {
      authData: {
        apiKey: 'invalid_token',
      },
    };

    try {
      await appTester(App.authentication.test, invalidBundle);
      // If no error is thrown, use should to assert failure
      should(false).be.true('Expected an error, but none was thrown');
    } catch (error) {
      // Check if the thrown error is the expected '401 Unauthorized' error
      should(error.message).containEql('401');
    }
  });
});

