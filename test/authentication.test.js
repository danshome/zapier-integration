const should = require('should');
const authentication = require('../authentication');
const { bundle } = require('./_bundle');
const zapier = require('zapier-platform-core');

zapier.tools.env.inject();

const App = require('../index');
const appTester = zapier.createAppTester(App);

describe('Authentication tests', () => {
  it('should authenticate successfully with valid credentials', async () => {
    // Use the bundle as is, assuming TEST_TOKEN is set correctly
    await appTester(authentication.test, bundle);
    // Add assertions as necessary
  });

  it('should fail authentication with invalid credentials', async () => {
    const invalidBundle = {
      authData: {
        accessToken: 'invalid_token',
      },
    };

    try {
      await appTester(authentication.test, invalidBundle);
      // If no error is thrown, use should to assert failure
      should(false).be.true('Expected an error, but none was thrown');
    } catch (error) {
      // Check if the thrown error is the expected '401 Unauthorized' error
      should(error.message).containEql('401');
    }
  });
});

