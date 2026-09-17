'use strict';

/**
 * Runs the Replay Shopify Orders action locally in DRY RUN mode against the
 * real Shopify and InnoVint APIs. It never records anything in InnoVint.
 *
 * Usage:  npm run replay:dry-run -- 3495 3499 3501 3502
 *
 * Needs these in .env (which is git-ignored):
 *   API_KEY=<InnoVint personal access token>
 *   INNOVINT_WINERY_ID=<winery id, e.g. wnry_...>
 *   SHOPIFY_SHOP_DOMAIN=<store>.myshopify.com
 *   SHOPIFY_ACCESS_TOKEN=<Admin API access token with read_orders and read_all_orders>
 */
require('dotenv').config();
const zapier = require('zapier-platform-core');
const App = require('../index');

const main = async () => {
  const orderNumbers = process.argv.slice(2);
  const missing = ['API_KEY', 'INNOVINT_WINERY_ID', 'SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']
      .filter((name) => !process.env[name]);
  if (missing.length || !orderNumbers.length) {
    console.error(`Usage: npm run replay:dry-run -- <order numbers...>`);
    if (missing.length) {
      console.error(`Missing in .env: ${missing.join(', ')}`);
    }
    process.exit(1);
  }

  const appTester = zapier.createAppTester(App);
  const result = await appTester(App.creates.replayShopifyOrders.operation.perform, {
    authData: {
      apiKey: process.env.API_KEY,
      shopifyShopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
      shopifyAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    },
    inputData: {
      wineryId: process.env.INNOVINT_WINERY_ID,
      orderNumbers,
      dryRun: true, // Always a dry run from this script.
      skipAlreadyRecorded: true,
    },
  });

  for (const order of result.orders) {
    console.log(`#${order.orderNumber}  ${order.status}  effective ${order.effectiveAt || '-'}` +
      (order.error ? `  ${order.error}` : ''));
    for (const line of result.lines.filter((item) => item.orderNumber === order.orderNumber)) {
      console.log(`    ${line.sku.padEnd(22)} ${String(line.bottles).padStart(3)} btl  ${line.result}` +
        (line.referenceNumber ? `  ref ${line.referenceNumber}` : '') + (line.error ? `  ${line.error}` : ''));
    }
  }
  console.log(`\nWould record ${result.linesWouldRecord} line(s); ` +
    `${result.linesAlreadyRecorded} already in InnoVint; ` +
    `${result.linesWithProblems} line problem(s); ${result.ordersWithProblems} order problem(s).`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
