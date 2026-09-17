'use strict';

const should = require('should');

const {buildAdjustments, isSwitchedOn, parseOrderNumbers, skipReason} = require('../../../lib/replay');
const {normalizeShopDomain} = require('../../../lib/shopify');
const {describeError} = require('../../../lib/errors');

const order = (extra) => Object.assign({
  name: '#1',
  test: false,
  cancelledAt: null,
  displayFinancialStatus: 'PAID',
  lineItems: {pageInfo: {hasNextPage: false}, nodes: []},
}, extra);

describe('lib/replay', () => {
  it('parses order numbers typed or mapped in Zapier', () => {
    should(parseOrderNumbers('#3495, 3499\n3501;3495').numbers).eql(['3495', '3499', '3501']);
    should(parseOrderNumbers(['3495', '#3499']).numbers).eql(['3495', '3499']);
    should(parseOrderNumbers('').numbers).eql([]);
    should(parseOrderNumbers('3495, RC-3499, abc').invalid).eql(['RC-3499', 'abc']);
  });

  it('keeps a safety switch on unless it is clearly turned off', () => {
    // Off only for these.
    [false, 'false', 'False', ' no ', 'NO', '0', 'off', 'n'].forEach((value) => {
      should(isSwitchedOn(value)).be.false(`${JSON.stringify(value)} should be off`);
    });
    // On for everything else, including empty, unmapped and typos.
    [undefined, null, '', true, 'true', 'yes', '1', 'Y', 'y', 'on', ' true ', 'nope', 'ja', ['false'], {}]
        .forEach((value) => {
          should(isSwitchedOn(value)).be.true(`${JSON.stringify(value)} should stay on`);
        });
  });

  it('counts the bottles the customer kept, per CG- SKU', () => {
    const adjustments = buildAdjustments(order({
      lineItems: {
        nodes: [
          {sku: 'CG-B1700RCVMER', quantity: 2, currentQuantity: 2},
          {sku: 'CG-B1700RCVMER', quantity: 1, currentQuantity: 1},
          {sku: 'CG-B2102RCVCHA', quantity: 3, currentQuantity: 1},
          {sku: 'CG-B1500RCVMER', quantity: 1, currentQuantity: 0},
          {sku: 'MWG-PRI-SEMI-RBRT-0000-01', quantity: 5, currentQuantity: 5},
          {sku: null, quantity: 1, currentQuantity: 1},
        ],
      },
    }));
    should(adjustments).eql([
      {sku: 'CG-B1700RCVMER', bottles: 3, orderedBottles: 3},
      {sku: 'CG-B2102RCVCHA', bottles: 1, orderedBottles: 3},
      {sku: 'CG-B1500RCVMER', bottles: 0, orderedBottles: 1},
    ]);
  });

  it('falls back to the ordered quantity when Shopify sends no current quantity', () => {
    should(buildAdjustments(order({lineItems: {nodes: [{sku: 'CG-X', quantity: 4}]}})))
        .eql([{sku: 'CG-X', bottles: 4, orderedBottles: 4}]);
  });

  it('replays only orders the paid-order Zap would have recorded', () => {
    should(skipReason(order())).be.null();
    should(skipReason(order({displayFinancialStatus: 'PARTIALLY_REFUNDED'}))).be.null();
    should(skipReason(order({test: true}))).equal('skipped_test_order');
    should(skipReason(order({cancelledAt: '2026-04-04T20:07:53Z'}))).equal('skipped_cancelled');
    should(skipReason(order({displayFinancialStatus: 'VOIDED'}))).equal('skipped_voided');
    should(skipReason(order({displayFinancialStatus: 'REFUNDED'}))).equal('skipped_refunded');
    should(skipReason(order({displayFinancialStatus: 'PENDING'}))).equal('skipped_not_paid');
    should(skipReason(order({displayFinancialStatus: 'AUTHORIZED'}))).equal('skipped_not_paid');
  });

  it('accepts only a myshopify.com store domain', () => {
    should(normalizeShopDomain(' HTTPS://Your-Store.myshopify.com/admin/orders ')).equal('your-store.myshopify.com');
    should(normalizeShopDomain('your-store')).equal('your-store.myshopify.com');
    should(normalizeShopDomain('your-store.myshopify.com.')).equal('your-store.myshopify.com');
    should(normalizeShopDomain('')).equal('');
    // These must not end up as the request host.
    should(normalizeShopDomain('evil.com#.myshopify.com')).equal('evil.com');
    should(normalizeShopDomain('store.myshopify.com@evil.com')).equal('store.myshopify.com@evil.com');
    should(normalizeShopDomain('evil.com\\.myshopify.com')).equal('evil.com');
  });

  it('turns an HTTP failure into one readable sentence', () => {
    const responseError = JSON.stringify({
      status: 500,
      content: JSON.stringify({errors: [{code: 'SERVER_ERROR', details: 'Something broke.'}]}),
      request: {url: 'https://sutter.innovint.us/api/v1/wineries/wnry_X/lots'},
    });
    should(describeError(new Error(responseError)))
        .equal('sutter.innovint.us returned HTTP 500: Something broke.');
    should(describeError(new Error(JSON.stringify({message: 'The API Key you supplied is incorrect'}))))
        .equal('The API Key you supplied is incorrect');
    should(describeError(new Error('plain message'))).equal('plain message');
  });
});
