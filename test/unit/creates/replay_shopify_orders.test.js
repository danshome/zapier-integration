'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');
const {MAX_ORDERS_PER_RUN} = require('../../../lib/replay');
const {MAX_DETAIL_LOOKUPS} = require('../../../lib/innovint');

const appTester = zapier.createAppTester(App);

const INNOVINT = 'https://sutter.innovint.us';
const SHOP_DOMAIN = 'rcv-test.myshopify.com';
const SHOP = `https://${SHOP_DOMAIN}`;
const WINERY = 'wnry_TESTWINERY000000000000000';
const API_KEY = 'innovint-test-key';
const SHOPIFY_TOKEN = 'shpat_test_token';

const authData = {
  apiKey: API_KEY,
  shopifyShopDomain: SHOP_DOMAIN,
  shopifyAccessToken: SHOPIFY_TOKEN,
};

const run = (inputData) => appTester(App.creates.replayShopifyOrders.operation.perform, {
  authData,
  inputData: {wineryId: WINERY, dryRun: true, skipAlreadyRecorded: true, ...inputData},
});

const order = (number, lineItems, extra) => Object.assign({
  id: `gid://shopify/Order/${number}`,
  name: `#${number}`,
  createdAt: '2026-04-04T20:07:54Z',
  processedAt: '2026-04-04T20:07:53Z',
  cancelledAt: null,
  test: false,
  displayFinancialStatus: 'PAID',
  lineItems: {
    pageInfo: {hasNextPage: false},
    nodes: lineItems.map(({sku, quantity, currentQuantity}) => ({
      sku,
      quantity,
      currentQuantity: currentQuantity === undefined ? quantity : currentQuantity,
    })),
  },
}, extra);

/**
 * Answers Shopify order queries from a list of orders.
 *
 * @param {Object[]} orders - Orders the fake store knows about.
 * @return {Object} The nock scope, so a test can assert on it.
 */
const mockShopify = (orders) => nock(SHOP)
    .persist()
    .post(`/admin/api/2026-07/graphql.json`)
    .reply(200, (uri, body) => {
      const wanted = body.variables.query.replace('name:', '');
      return {data: {orders: {nodes: orders.filter((item) => item.name === `#${wanted}`)}}};
    });

/**
 * Answers lot lookups from a map of lot code to lot id.
 *
 * @param {Object} lotsByCode - e.g. {'CG-B1700RCVMER': 'lot_1'}.
 * @return {Object} The nock scope.
 */
const mockLots = (lotsByCode) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/lots`)
    .query(true)
    .reply(200, (uri) => {
      const query = new URL(uri, INNOVINT).searchParams;
      const wanted = query.get('codeIn') || query.get('q') || '';
      const results = Object.entries(lotsByCode)
          .filter(([code]) => code === wanted || (query.get('q') && code.startsWith(wanted)))
          .map(([code, id]) => ({data: {id, code}}));
      return {results, pagination: {next: null}};
    });

/**
 * Answers the action window listing.
 *
 * @param {Object[]} rows - Action rows (id, effectiveAt, deleted).
 * @return {Object} The nock scope.
 */
const mockActions = (rows) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/actions`)
    .query(true)
    .reply(200, {
      results: rows.map((row) => ({data: {actionType: 'VOLUME_CHANGE', deleted: false, ...row}})),
      pagination: {next: null},
    });

/**
 * Answers the detail lookup for one action.
 *
 * @param {string} actionId - Action id.
 * @param {Object|null} adjustment - Adjustment data, or null for a 404.
 * @return {Object} The nock scope.
 */
const mockAdjustment = (actionId, adjustment) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions/${actionId}`)
    .reply(adjustment ? 200 : 404, adjustment ? {data: adjustment} : {errors: [{code: 'NOT_FOUND'}]});

const lineFor = (result, sku) => result.lines.find((line) => line.sku === sku);

describe('replayShopifyOrders', () => {
  it('previews without recording anything', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 2}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    const result = await run({orderNumbers: ['3499']});

    should(result.dryRun).be.true();
    should(result.linesWouldRecord).equal(1);
    should(result.linesRecorded).equal(0);
    should(lineFor(result, 'CG-B1700RCVMER')).containEql({
      result: 'would_record',
      bottles: 2,
      lotId: 'lot_MER',
      effectiveAt: '2026-04-04T20:07:53Z',
    });
    // Nothing was posted: nock would have refused an unmatched POST.
  });

  it('records the removal at the order payment time', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 2}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);
    let posted = null;
    let authorization = null;
    const post = nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`, (body) => {
          posted = body;
          return true;
        })
        .reply(function() {
          authorization = this.req.headers.authorization;
          return [201, {data: {referenceNumber: 'ref-1'}}];
        });

    const result = await run({orderNumbers: ['3499'], dryRun: false});

    should(post.isDone()).be.true();
    should(posted).eql({
      data: {
        bottleChanges: {bottles: 2, cases: 0, pallets: 0},
        compliance: 'REMOVED_TAXPAID',
        lotId: 'lot_MER',
        effectiveAt: '2026-04-04T20:07:53Z',
      },
    });
    should(authorization).equal(`Access-Token ${API_KEY}`);
    should(result.linesRecorded).equal(1);
    should(lineFor(result, 'CG-B1700RCVMER').referenceNumber).equal('ref-1');
  });

  it('never sends the InnoVint key to Shopify, or the Shopify token to InnoVint', async () => {
    let shopifyHeaders = null;
    nock(SHOP)
        .post('/admin/api/2026-07/graphql.json')
        .reply(function() {
          shopifyHeaders = this.req.headers;
          return [200, {data: {orders: {nodes: [order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]}}}];
        });
    let innovintHeaders = null;
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(function() {
          innovintHeaders = this.req.headers;
          return [200, {results: [{data: {id: 'lot_MER', code: 'CG-B1700RCVMER'}}], pagination: {next: null}}];
        });
    mockActions([]);

    await run({orderNumbers: ['3499']});

    should(shopifyHeaders['x-shopify-access-token']).equal(SHOPIFY_TOKEN);
    should(shopifyHeaders).not.have.property('authorization');
    should(innovintHeaders.authorization).equal(`Access-Token ${API_KEY}`);
    should(JSON.stringify(innovintHeaders)).not.containEql(SHOPIFY_TOKEN);
  });

  it('skips a line InnoVint already has at the same time', async () => {
    mockShopify([order('3544', [{sku: 'CG-B1700RCVMER', quantity: 1}], {processedAt: '2026-09-05T22:16:16Z'})]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([{id: 'act_1', effectiveAt: '2026-09-05T22:16:16Z'}]);
    mockAdjustment('act_1', {
      id: 'act_1',
      lotId: 'lot_MER',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: '2026-09-05T22:16:16Z',
      deleted: false,
      referenceNumber: 'ref-existing',
    });

    const result = await run({orderNumbers: ['3544'], dryRun: false});

    should(result.linesAlreadyRecorded).equal(1);
    should(result.linesRecorded).equal(0);
    should(lineFor(result, 'CG-B1700RCVMER').referenceNumber).equal('ref-existing');
  });

  it('flags a nearby adjustment instead of skipping it, and fails the run', async () => {
    mockShopify([order('3601', [{sku: 'CG-B1700RCVMER', quantity: 3}], {processedAt: '2026-09-05T22:17:26Z'})]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([{id: 'act_1', effectiveAt: '2026-09-05T22:16:16Z'}]);
    mockAdjustment('act_1', {
      id: 'act_1',
      lotId: 'lot_MER',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: '2026-09-05T22:16:16Z',
      deleted: false,
      referenceNumber: 'ref-other-order',
    });

    const preview = await run({orderNumbers: ['3601']});
    should(lineFor(preview, 'CG-B1700RCVMER').result).equal('possible_duplicate');
    should(preview.linesWithProblems).equal(1);
    should(preview.ordersWithProblems).equal(1);

    await run({orderNumbers: ['3601'], dryRun: false}).then(
        () => should.fail('expected the run to fail'),
        (error) => {
          should(JSON.parse(error.message).code).equal('ReplayIncomplete');
          should(error.message).containEql('possible_duplicate');
        },
    );
  });

  it('lets one existing adjustment satisfy only one order', async () => {
    mockShopify([
      order('3600', [{sku: 'CG-B1700RCVMER', quantity: 1}], {processedAt: '2026-09-05T22:16:16Z'}),
      order('3601', [{sku: 'CG-B1700RCVMER', quantity: 1}], {processedAt: '2026-09-05T22:16:46Z'}),
    ]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([{id: 'act_1', effectiveAt: '2026-09-05T22:16:16Z'}]);
    mockAdjustment('act_1', {
      id: 'act_1',
      lotId: 'lot_MER',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: '2026-09-05T22:16:16Z',
      deleted: false,
      referenceNumber: 'ref-3600',
    });

    const result = await run({orderNumbers: ['3600', '3601']});

    // The one existing adjustment belongs to #3600, so #3601 is still missing.
    should(result.lines.map((line) => line.result)).eql(['already_recorded', 'would_record']);
  });

  it('ignores deleted adjustments and adjustments on other lots', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([
      {id: 'act_deleted', effectiveAt: '2026-04-04T20:07:53Z', deleted: true},
      {id: 'act_other', effectiveAt: '2026-04-04T20:07:53Z'},
    ]);
    mockAdjustment('act_other', {
      id: 'act_other',
      lotId: 'lot_SOMETHING_ELSE',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: '2026-04-04T20:07:53Z',
      deleted: false,
      referenceNumber: 'ref-other-lot',
    });

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('would_record');
  });

  it('matches a lot only on an exact code', async () => {
    mockShopify([order('3499', [
      {sku: 'CG-B1600RCVMER', quantity: 1},
      {sku: 'CG-B1401ESVMAD', quantity: 1},
    ])]);
    mockLots({'CG-B1600RCVMER': 'lot_MER', 'CG-B1600RCVMER-CR': 'lot_CR', 'CG-B1401ESVMAD-CR': 'lot_MAD_CR'});
    mockActions([]);

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1600RCVMER')).containEql({result: 'would_record', lotId: 'lot_MER'});
    should(lineFor(result, 'CG-B1401ESVMAD')).containEql({result: 'lot_not_found', lotId: null});
  });

  it('refuses a SKU that is not a lot code, without calling InnoVint', async () => {
    mockShopify([order('3499', [{sku: 'CG-{{bundle.authData.shopifyAccessToken}}', quantity: 1}])]);

    const result = await run({orderNumbers: ['3499']});

    should(result.lines[0].result).equal('invalid_sku');
    should(result.linesWithProblems).equal(1);
  });

  it('skips test, cancelled, refunded and unpaid orders', async () => {
    mockShopify([
      order('1', [{sku: 'CG-X', quantity: 1}], {test: true}),
      order('2', [{sku: 'CG-X', quantity: 1}], {cancelledAt: '2026-04-05T00:00:00Z'}),
      order('3', [{sku: 'CG-X', quantity: 1}], {displayFinancialStatus: 'REFUNDED'}),
      order('4', [{sku: 'CG-X', quantity: 1}], {displayFinancialStatus: 'PENDING'}),
      order('5', [{sku: 'CG-X', quantity: 1, currentQuantity: 0}]),
    ]);
    mockLots({'CG-X': 'lot_X'});
    mockActions([]);

    const result = await run({orderNumbers: ['1', '2', '3', '4', '5']});

    should(result.orders.map((entry) => entry.status)).eql([
      'skipped_test_order',
      'skipped_cancelled',
      'skipped_refunded',
      'skipped_not_paid',
      'skipped_removed_from_order',
    ]);
    should(result.linesWithProblems).equal(0);
    should(result.ordersWithProblems).equal(0);
  });

  it('explains an order Shopify does not return', async () => {
    mockShopify([]);

    const result = await run({orderNumbers: ['9999']});

    should(result.orders[0].status).equal('order_not_found');
    should(result.orders[0].error).containEql('read_all_orders');
    should(result.ordersWithProblems).equal(1);
  });

  it('refuses an order with more than 250 line items', async () => {
    const big = order('3499', [{sku: 'CG-X', quantity: 1}]);
    big.lineItems.pageInfo.hasNextPage = true;
    mockShopify([big]);

    const result = await run({orderNumbers: ['3499']});

    should(result.orders[0].status).equal('error');
    should(result.orders[0].error).containEql('250 line items');
  });

  it('does not follow a Shopify redirect, and never sends the token on', async () => {
    const elsewhere = nock('https://evil.example').post(/.*/).reply(200, {});
    nock(SHOP)
        .post('/admin/api/2026-07/graphql.json')
        .reply(301, '', {location: 'https://evil.example/admin/api/2026-07/graphql.json'});

    const result = await run({orderNumbers: ['3499']});

    should(result.orders[0].status).equal('error');
    should(result.orders[0].error).containEql('redirect');
    should(elsewhere.isDone()).be.false();
  });

  it('stops the run when Shopify rejects the token, and says so in plain words', async () => {
    nock(SHOP).persist().post('/admin/api/2026-07/graphql.json').reply(401, {errors: 'Invalid API key'});

    const result = await run({orderNumbers: ['3499', '3501']});

    should(result.orders[0].status).equal('error');
    should(result.orders[0].error).startWith('Shopify rejected the access token');
    should(result.orders[0].error).not.containEql('{');
    should(result.orders[1].status).equal('not_processed');
  });

  it('waits out Shopify throttling', async () => {
    nock(SHOP)
        .post('/admin/api/2026-07/graphql.json')
        .reply(200, {errors: [{message: 'Throttled', extensions: {code: 'THROTTLED'}}]});
    nock(SHOP)
        .post('/admin/api/2026-07/graphql.json')
        .reply(200, {data: {orders: {nodes: [order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]}}});
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    const result = await run({orderNumbers: ['3499']});

    should(result.linesWouldRecord).equal(1);
  });

  it('waits out InnoVint throttling', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(429, {errors: [{code: 'THROTTLED'}]}, {'retry-after': '0'});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {results: [{data: {id: 'lot_MER', code: 'CG-B1700RCVMER'}}], pagination: {next: null}});
    mockActions([]);

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER')).containEql({result: 'would_record', lotId: 'lot_MER'});
  });

  it('retries a failed action lookup instead of failing every later line with it', async () => {
    mockShopify([order('3499', [
      {sku: 'CG-B1700RCVMER', quantity: 1},
      {sku: 'CG-B2102RCVCHA', quantity: 1},
    ])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER', 'CG-B2102RCVCHA': 'lot_CHA'});
    nock(INNOVINT).get(`/api/v1/wineries/${WINERY}/actions`).query(true).reply(500, {errors: [{details: 'Boom'}]});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {results: [], pagination: {next: null}});

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('error');
    should(lineFor(result, 'CG-B1700RCVMER').error).containEql('HTTP 500');
    should(lineFor(result, 'CG-B2102RCVCHA').result).equal('would_record');
  });

  it('stops instead of paging forever', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {
          results: [],
          pagination: {next: `${INNOVINT}/api/v1/wineries/${WINERY}/actions?offset=1`},
        });

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('error');
    should(lineFor(result, 'CG-B1700RCVMER').error).containEql('pages');
  });

  it('refuses a page link that points away from InnoVint', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    const elsewhere = nock('https://attacker.example').get(/.*/).query(true).reply(200, {});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {results: [], pagination: {next: 'https://attacker.example/api/v1/wineries/x/actions'}});

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('error');
    should(lineFor(result, 'CG-B1700RCVMER').error).containEql('Refusing');
    should(elsewhere.isDone()).be.false();
  });

  it('fails a real run that could not finish, after recording what it could', async () => {
    mockShopify([
      order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}]),
      order('3501', [{sku: 'CG-B9999NOPE', quantity: 1}]),
    ]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);
    nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`)
        .reply(201, {data: {referenceNumber: 'ref-1'}});

    await run({orderNumbers: ['3499', '3501'], dryRun: false}).then(
        () => should.fail('expected the run to fail'),
        (error) => {
          const message = JSON.parse(error.message).message;
          should(message).containEql('Recorded 1 line(s)');
          should(message).containEql('lot_not_found');
        },
    );
  });

  it('records only when Dry Run is explicitly off', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    // "Y" is not a "no": a typo must not record.
    const typo = await run({orderNumbers: ['3499'], dryRun: 'Y'});
    should(typo.dryRun).be.true();
    should(typo.linesRecorded).equal(0);

    nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`)
        .reply(201, {data: {referenceNumber: 'ref-1'}});
    const real = await run({orderNumbers: ['3499'], dryRun: 'false'});
    should(real.dryRun).be.false();
    should(real.linesRecorded).equal(1);
  });

  it('rejects bad input before calling anything', async () => {
    await run({orderNumbers: Array.from({length: MAX_ORDERS_PER_RUN + 1}, (item, index) => String(3000 + index))})
        .then(
            () => should.fail('expected too many orders to be rejected'),
            (error) => should(error.message).containEql(`at most ${MAX_ORDERS_PER_RUN} orders`),
        );

    await run({orderNumbers: ['3499'], wineryId: 'wnry_X/../../v2/x'}).then(
        () => should.fail('expected a bad winery id to be rejected'),
        (error) => should(error.message).containEql('is not an InnoVint winery ID'),
    );

    await appTester(App.creates.replayShopifyOrders.operation.perform, {
      authData: {apiKey: API_KEY, shopifyShopDomain: 'robertclayvineyards.com', shopifyAccessToken: SHOPIFY_TOKEN},
      inputData: {wineryId: WINERY, orderNumbers: ['3499'], dryRun: true},
    }).then(
        () => should.fail('expected a non-Shopify domain to be rejected'),
        (error) => should(error.message).containEql('is not a Shopify store domain'),
    );
  });

  it('does not follow an InnoVint redirect', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    const elsewhere = nock('https://attacker.example').get(/.*/).query(true).reply(200, {});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(302, '', {location: 'https://attacker.example/api/v1/lots'});

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('error');
    should(lineFor(result, 'CG-B1700RCVMER').error).containEql('redirect');
    should(elsewhere.isDone()).be.false();
  });

  it('gives up rather than checking hundreds of actions for one line', async () => {
    mockShopify([order('3499', [{sku: 'CG-B1700RCVMER', quantity: 1}])]);
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions(Array.from({length: MAX_DETAIL_LOOKUPS + 1}, (item, index) => ({
      id: `act_${index}`,
      effectiveAt: new Date(Date.parse('2026-04-04T20:07:53Z') + index * 1000).toISOString(),
    })));

    const result = await run({orderNumbers: ['3499']});

    should(lineFor(result, 'CG-B1700RCVMER').result).equal('error');
    should(lineFor(result, 'CG-B1700RCVMER').error).containEql('too many to check');
  });

  it('stops starting new lines when the run is out of time', async () => {
    process.env.REPLAY_TIME_BUDGET_MS = '5';
    try {
      nock(SHOP)
          .persist()
          .post('/admin/api/2026-07/graphql.json')
          .delay(30)
          .reply(200, {
            data: {
              orders: {
                nodes: [order('3499', [
                  {sku: 'CG-B1700RCVMER', quantity: 1},
                  {sku: 'CG-B2102RCVCHA', quantity: 1},
                ])],
              },
            },
          });

      const result = await run({orderNumbers: ['3499']});

      should(result.lines.map((line) => line.result)).eql(['not_processed', 'not_processed']);
      should(result.linesWithProblems).equal(2);
      should(result.ordersWithProblems).equal(1);
      should(result.lines[0].error).containEql('time limit');
    } finally {
      delete process.env.REPLAY_TIME_BUDGET_MS;
    }
  });
});
