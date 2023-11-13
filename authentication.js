require('dotenv').config(); // Loads variables from .env file

// The test call Zapier makes to ensure an access token is valid
// UX TIP: Hit an endpoint that always returns data with valid credentials,
// like a /profile or /me endpoint. That way the success/failure is related to
// the token and not because the user didn't happen to have a recently created record.
const testAuth = (z, bundle) => {
  const testUrl = 'https://sutter.innovint.us/api/v1/wineries';

  // Use the accessToken from bundle for authentication
  const accessToken = bundle.authData.accessToken || process.env.ACCESS_TOKEN;

  return z.request({
    url: testUrl,
    method: 'GET',
    headers: {
      'Authorization': `Access-Token ${accessToken}`
    }
  }).then(response => {
    if (response.status !== 200 || response.content.includes('some_error_indicator')) {
      throw new Error('The provided Access Token is invalid.');
    }
    return response;
  });
};

const includeAccessTokenHeader = (request, z, bundle) => {
  // Prioritize the token from the bundle, fall back to the environment variable
  const accessToken = bundle.authData.accessToken || process.env.ACCESS_TOKEN;

  if (accessToken) {
    request.headers = request.headers || {};
    request.headers['Authorization'] = `Access-Token ${accessToken}`;
  }

  return request;
};

module.exports = {
  type: 'custom',
  connectionLabel: '{{bundle.authData.connectionLabel}}',
  fields: [
    {
      key: 'accessToken',
      label: 'Access Token',
      required: true,
      type: 'string',
      helpText: 'Your personal access token for the API.'
    },
  ],
  test: testAuth,
  befores: [includeAccessTokenHeader],
  afters: [],
};
