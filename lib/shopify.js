'use strict';

const API_VERSION = '2026-07';

/** Only a real Shopify store domain, so the access token can only go to Shopify. */
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const MAX_THROTTLE_RETRIES = 2;
const THROTTLE_DELAY_SECONDS = 2;
const MAX_RETRY_DELAY_SECONDS = 5;

const ORDER_QUERY = `query ReplayOrder($query: String!) {
  orders(first: 5, query: $query) {
    nodes {
      id
      name
      createdAt
      processedAt
      cancelledAt
      test
      displayFinancialStatus
      lineItems(first: 250) {
        pageInfo {
          hasNextPage
        }
        nodes {
          sku
          quantity
          currentQuantity
        }
      }
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes what a person might paste as the store domain.
 *
 * @param {string} value - e.g. "https://your-store.myshopify.com/admin" or "your-store".
 * @return {string} e.g. "your-store.myshopify.com", or "" when empty.
 */
const normalizeShopDomain = (value) => {
  const domain = String(value || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .split(/[/?#\\]/)[0]
      .replace(/\.+$/, '')
      .toLowerCase();
  if (!domain) {
    return '';
  }
  return domain.includes('.') ? domain : `${domain}.myshopify.com`;
};

/**
 * Returns the Shopify store domain and token from the connection, or throws a
 * message telling the person which connection fields to fix.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} bundle - The Zapier bundle.
 * @return {{shop: string, token: string}} Store domain and access token.
 */
const requireShopifyCredentials = (z, bundle) => {
  const shop = normalizeShopDomain(bundle.authData.shopifyShopDomain);
  const token = String(bundle.authData.shopifyAccessToken || '').trim();
  if (!shop || !token) {
    throw new z.errors.Error(
        'Replaying Shopify orders needs a Shopify store domain and Admin API access token. ' +
          'Edit this InnoVint connection in Zapier and fill in both Shopify fields.',
        'ShopifyNotConfigured',
        400,
    );
  }
  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new z.errors.Error(
        `"${shop.slice(0, 60)}" is not a Shopify store domain. Use the myshopify.com address of the store, ` +
          'such as your-store.myshopify.com, so the access token is only ever sent to Shopify.',
        'ShopifyNotConfigured',
        400,
    );
  }
  return {shop, token};
};

const retryAfterSeconds = (response) => {
  const header = response.headers && response.headers.get && response.headers.get('retry-after');
  const seconds = parseInt(header, 10);
  return Number.isNaN(seconds) || seconds < 0 ? null : seconds;
};

const isThrottledBody = (body) =>
  ((body && body.errors) || []).some((error) =>
    (error.extensions && error.extensions.code === 'THROTTLED') || /throttl/i.test(error.message || ''));

/**
 * Fetches one Shopify order by its order number.
 *
 * @param {Object} z - The Zapier z object.
 * @param {Object} bundle - The Zapier bundle (Shopify credentials come from authData).
 * @param {string} orderNumber - Order number without the leading #, e.g. "3495".
 * @return {Promise<Object|null>} The order, or null if no order has that number.
 */
const getOrderByNumber = async (z, bundle, orderNumber) => {
  const {shop, token} = requireShopifyCredentials(z, bundle);

  for (let attempt = 0; ; attempt++) {
    const response = await z.request({
      url: `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: {query: ORDER_QUERY, variables: {query: `name:${orderNumber}`}},
      skipThrowForStatus: true,
      throwForThrottlingEarly: false,
      // A redirect would carry the access token to another host; never follow one.
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      throw new z.errors.Error(
          `Shopify answered with a redirect (HTTP ${response.status}) instead of order data. ` +
            `Check that the Shopify Store Domain on this connection is right: ${shop}.`,
          'ShopifyRedirect',
          response.status,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new z.errors.Error(
          `Shopify rejected the access token for ${shop} (HTTP ${response.status}). Check the token, and that ` +
            'the custom app has the read_orders and read_all_orders scopes.',
          'ShopifyAuthError',
          response.status,
      );
    }
    if (response.status === 404) {
      throw new z.errors.Error(
          `Shopify store ${shop} was not found. Check the Shopify Store Domain on this connection.`,
          'ShopifyNotFound',
          404,
      );
    }

    const body = response.data || {};
    const throttled = response.status === 429 || isThrottledBody(body);
    if (throttled) {
      if (attempt >= MAX_THROTTLE_RETRIES) {
        throw new z.errors.ThrottledError(
            'Shopify is rate limiting this store. Wait a minute and run it again.',
            retryAfterSeconds(response) || 60,
        );
      }
      const delay = Math.min(retryAfterSeconds(response) || THROTTLE_DELAY_SECONDS, MAX_RETRY_DELAY_SECONDS);
      await sleep(delay * 1000);
      continue;
    }

    if (response.status >= 400) {
      throw new z.errors.Error(
          `Shopify returned HTTP ${response.status} for order ${orderNumber}.`,
          'ShopifyError',
          response.status,
      );
    }
    if (body.errors && body.errors.length) {
      throw new z.errors.Error(
          `Shopify: ${body.errors.map((error) => error.message).join('; ')}`,
          'ShopifyError',
          400,
      );
    }

    const orders = (body.data && body.data.orders && body.data.orders.nodes) || [];
    const order = orders.find((item) => item.name === `#${orderNumber}`) || null;
    if (order && order.lineItems && order.lineItems.pageInfo && order.lineItems.pageInfo.hasNextPage) {
      throw new z.errors.Error(
          `Order #${orderNumber} has more than 250 line items, which this action cannot replay. ` +
            'Record it in InnoVint by hand.',
          'TooManyLineItems',
          400,
      );
    }
    return order;
  }
};

module.exports = {
  API_VERSION,
  SHOP_DOMAIN_PATTERN,
  getOrderByNumber,
  normalizeShopDomain,
  requireShopifyCredentials,
};
