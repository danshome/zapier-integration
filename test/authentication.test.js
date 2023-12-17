const should = require('should');
const {bundle} = require('./_bundle');
const zapier = require('zapier-platform-core');

zapier.tools.env.inject();

const App = require('../index');
const appTester = zapier.createAppTester(App);

describe('Authentication tests', () => {
  it('should authenticate successfully with valid credentials', async () => {
    // Use the bundle as is, assuming TEST_API_KEY is set correctly
    const response = await appTester(App.authentication.test, bundle);

    // Assert that the response is successful and contains expected data
    should(response.status).equal(200); // Assuming a status 200 for successful authentication
    // Add more specific assertions based on the expected response structure
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

