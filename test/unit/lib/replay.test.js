'use strict';

const should = require('should');

const {buildAdjustments, isSwitchedOn, skipReason, splitList} = require('../../../lib/replay');
const {describeError} = require('../../../lib/errors');

describe('lib/replay', () => {
  it('splits a mapped line-item field, keeping empty positions', () => {
    should(splitList('CG-A, , CG-B')).eql(['CG-A', '', 'CG-B']);
    should(splitList(['CG-A', null, 'CG-B'])).eql(['CG-A', '', 'CG-B']);
    should(splitList('')).eql([]);
    should(splitList(undefined)).eql([]);
  });

  it('keeps a safety switch on unless it is clearly turned off', () => {
    [false, 'false', 'False', ' no ', 'NO', '0', 'off', 'n'].forEach((value) => {
      should(isSwitchedOn(value)).be.false(`${JSON.stringify(value)} should be off`);
    });
    [undefined, null, '', true, 'true', 'yes', '1', 'Y', 'y', 'on', ' true ', 'nope', ['false'], {}]
        .forEach((value) => {
          should(isSwitchedOn(value)).be.true(`${JSON.stringify(value)} should stay on`);
        });
  });

  it('adds up bottles per CG- SKU and ignores everything else', () => {
    should(buildAdjustments(
        ['MWG-PRI-SEMI-RBRT-0000-01', 'CG-B1700RCVMER', 'CG-B1700RCVMER', 'CG-B2102RCVCHA', ''],
        ['3', '2', '1', '1', '4'],
    )).eql([
      {sku: 'CG-B1700RCVMER', bottles: 3, valid: true},
      {sku: 'CG-B2102RCVCHA', bottles: 1, valid: true},
    ]);
  });

  it('marks a line whose quantity is not a whole number of bottles', () => {
    should(buildAdjustments(['CG-A', 'CG-B', 'CG-C'], ['two', '0', '1.5'])).eql([
      {sku: 'CG-A', bottles: 0, valid: false},
      {sku: 'CG-B', bottles: 0, valid: false},
      {sku: 'CG-C', bottles: 0, valid: false},
    ]);
  });

  it('replays only orders the paid-order Zap would have recorded', () => {
    should(skipReason({financialStatus: 'PAID'})).be.null();
    should(skipReason({financialStatus: 'PARTIALLY_REFUNDED'})).be.null();
    should(skipReason({financialStatus: 'paid'})).be.null();
    should(skipReason({financialStatus: 'PAID', cancelledAt: '2026-04-05T00:00:00Z'})).equal('skipped_cancelled');
    should(skipReason({financialStatus: 'VOIDED'})).equal('skipped_voided');
    should(skipReason({financialStatus: 'REFUNDED'})).equal('skipped_refunded');
    should(skipReason({financialStatus: 'PENDING'})).equal('skipped_not_paid');
    should(skipReason({})).equal('skipped_status_unknown');
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
