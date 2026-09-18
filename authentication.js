'use strict';

const {BASE_URL, innovintRequest, isInnoVintUrl} = require('./lib/innovint');

// The test endpoint is one every user of this integration can reach. Returning
// the parsed body lets connectionLabel name the connection after the winery.
const test = async (z, bundle) => {
  const response = await innovintRequest(z, {url: `${BASE_URL}/wineries`});
  return response.data;
};

// Names the connection after the winery (or wineries) the key can reach.
const connectionLabel = (z, bundle) => {
  const names = ((bundle.inputData && bundle.inputData.results) || [])
      .map((result) => result.data && result.data.name)
      .filter(Boolean);
  if (!names.length) {
    return 'InnoVint';
  }
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more` : names.join(', ');
};

// This function runs after every outbound request. InnoVint rejects a bad key
// with 401.
const handleBadResponses = (response, z, bundle) => {
  const url = (response.request && response.request.url) || '';
  if (response.status === 401 && isInnoVintUrl(url)) {
    throw new z.errors.Error(
        // This message is surfaced to the user
        'The API Key you supplied is incorrect',
        'AuthenticationError',
        response.status,
    );
  }

  return response;
};

// This function runs before every outbound request. Only InnoVint ever sees the
// API key; every other host must not.
const includeApiKey = (request, z, bundle) => {
  const apiKey = bundle.authData.apiKey;

  if (apiKey && isInnoVintUrl(request.url)) {
    request.headers.Authorization = `Access-Token ${apiKey}`;
  }

  return request;
};

module.exports = {
  config: {
    // "custom" is the catch-all auth type. The user supplies some info and Zapier can
    // make authenticated requests with it
    type: 'custom',

    // Define any input app's auth requires here. The user will be prompted to enter
    // this info when they connect their account.
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        required: true,
        type: 'string',
        helpText: 'Go to the [API Details](https://cellar.innovint.us/#/developer/personal-access-token) ' +
            'page in your account settings to find your Personal Access Tokens for the API Key.',
      },
    ],

    // The test method allows Zapier to verify that the credentials a user provides
    // are valid. We'll execute this method whenever a user connects their account for
    // the first time.
    test,

    // The test returns the parsed body, so this function sees it as
    // bundle.inputData and names the connection after the winery.
    connectionLabel,
  },
  befores: [includeApiKey],
  afters: [handleBadResponses],
};
