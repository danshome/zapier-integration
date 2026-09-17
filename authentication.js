'use strict';

const {BASE_URL, innovintRequest, isInnoVintUrl} = require('./lib/innovint');

// The test endpoint is one every user of this integration can reach.
const test = (z, bundle) => innovintRequest(z, {url: `${BASE_URL}/wineries`});

// This function runs after every outbound request. InnoVint rejects a bad key
// with 401; Shopify responses are handled where they are made, in lib/shopify.
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
// API key: other hosts (Shopify, for the Replay Shopify Orders action) must not.
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
      {
        key: 'shopifyShopDomain',
        label: 'Shopify Store Domain',
        required: false,
        type: 'string',
        helpText: 'Only needed for the Replay Shopify Orders action. Your store\'s myshopify.com domain, ' +
            'for example `your-store.myshopify.com`. Custom domains are not accepted, so the access token ' +
            'below can only ever be sent to Shopify.',
      },
      {
        key: 'shopifyAccessToken',
        label: 'Shopify Admin API Access Token',
        required: false,
        type: 'password',
        helpText: 'Only needed for the Replay Shopify Orders action. In Shopify admin, create a custom app ' +
            '(Settings > Apps > Develop apps) with the `read_orders` and `read_all_orders` Admin API scopes ' +
            'and paste its Admin API access token here. `read_all_orders` is required for orders older ' +
            'than 60 days.',
      },
    ],

    // The test method allows Zapier to verify that the credentials a user provides
    // are valid. We'll execute this method whenever a user connects their account for
    // the first time.
    test,

    // This template string can access all the data returned from the auth test. If
    // you return the test object, you'll access the returned data with a label like
    // `{{json.X}}`. If you return `response.data` from your test, then your label can
    // be `{{X}}`. This can also be a function that returns a label. That function has
    // the standard args `(z, bundle)` and data returned from the test can be accessed
    // in `bundle.inputData.X`.
    connectionLabel: '{{json.username}}',
  },
  befores: [includeApiKey],
  afters: [handleBadResponses],
};
