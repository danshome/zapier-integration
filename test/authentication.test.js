const should = require('should');
const authentication = require('../authentication');
const zapier = require('zapier-platform-core');

zapier.tools.env.inject(); // Automatically injects the .env variables

const App = require('../index'); // Assuming your main app file is named index.js
const appTester = zapier.createAppTester(App);

describe('Authentication tests', () => {

  it('should authenticate successfully with valid credentials', async () => {
    const bundle = {
      authData: {
        accessToken: process.env.VALID_ACCESS_TOKEN, // Assuming you have this in your .env for testing
      },
    };

    // Use the appTester and the test function from the authentication module
    await appTester(authentication.test, bundle);
    // Add assertions here to verify successful authentication
  });

  it('should fail authentication with invalid credentials', async () => {
    const bundle = {
      authData: {
        accessToken: 'invalid_token',
      },
    };

    try {
      await appTester(authentication.test, bundle);
      // If no error is thrown, explicitly fail the test
      should(true).be.false('Expected an error, but none was thrown');
    } catch (error) {
      if (!error.message.includes('401')) {
        // If it's not a 401 error, then fail the test
        should(false).be.true(`Unexpected error thrown: ${error.message}`);
      }
    }
  });
});
