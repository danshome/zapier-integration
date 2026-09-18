'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');
const {MAX_DETAIL_LOOKUPS} = require('../../../lib/innovint');

const appTester = zapier.createAppTester(App);

const INNOVINT = 'https://sutter.innovint.us';
const WINERY = 'wnry_TESTWINERY000000000000000';
const API_KEY = 'innovint-test-key';
const EFFECTIVE_AT = '2026-04-04T20:07:53Z';

const run = (inputData) => appTester(App.creates.replayShopifyOrders.operation.perform, {
  authData: {apiKey: API_KEY},
  inputData: {
    wineryId: WINERY,
    orderNumber: '#3499',
    effectiveAt: EFFECTIVE_AT,
    financialStatus: 'PAID',
    cancelledAt: '',
    dryRun: true,
    skipAlreadyRecorded: true,
    ...inputData,
  },
});

const mockLots = (lotsByCode) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/lots`)
    .query(true)
    .reply(200, (uri) => {
      const query = new URL(uri, INNOVINT).searchParams;
      const wanted = query.get('codeIn') || query.get('q') || '';
      return {
        results: Object.entries(lotsByCode)
            .filter(([code]) => code === wanted || (query.get('q') && code.startsWith(wanted)))
            .map(([code, id]) => ({data: {id, code}})),
        pagination: {next: null},
      };
    });

const mockActions = (rows) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/actions`)
    .query(true)
    .reply(200, {
      results: rows.map((row) => ({data: {actionType: 'VOLUME_CHANGE', deleted: false, ...row}})),
      pagination: {next: null},
    });

const mockAdjustment = (actionId, adjustment) => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions/${actionId}`)
    .reply(200, {data: adjustment});

const lineFor = (result, sku) => result.lines.find((line) => line.sku === sku);

describe('replayShopifyOrders', () => {
  it('previews the case goods lines of an order without recording anything', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER', 'CG-B2200RCVTOUROSE': 'lot_ROSE'});
    mockActions([]);

    const result = await run({
      skus: 'CG-B2200RCVTOUROSE,CG-B1700RCVMER,MWG-PRI-SEMI-RBRT-0000-01',
      quantities: '4,2,1',
    });

    should(result.dryRun).be.true();
    should(result.status).equal('would_record');
    should(result.linesWouldRecord).equal(2);
    should(result.lines).have.length(2);
    should(lineFor(result, 'CG-B2200RCVTOUROSE')).containEql({bottles: 4, lotId: 'lot_ROSE'});
    // Nothing was posted: nock would have refused an unmatched POST.
  });

  it('records at the order payment time, with the InnoVint key', async () => {
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

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '2', dryRun: false});

    should(post.isDone()).be.true();
    should(posted).eql({
      data: {
        bottleChanges: {bottles: 2, cases: 0, pallets: 0},
        compliance: 'REMOVED_TAXPAID',
        lotId: 'lot_MER',
        effectiveAt: EFFECTIVE_AT,
      },
    });
    should(authorization).equal(`Access-Token ${API_KEY}`);
    should(result.linesRecorded).equal(1);
    should(result.status).equal('recorded');
  });

  it('adds up two line items of the same wine', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    const result = await run({skus: 'CG-B1700RCVMER,CG-B1700RCVMER', quantities: '2,1'});

    should(result.lines).have.length(1);
    should(result.lines[0].bottles).equal(3);
  });

  it('refuses SKU and quantity lists that do not line up', async () => {
    await run({skus: 'CG-A,CG-B', quantities: '1'}).then(
        () => should.fail('expected mismatched lists to be rejected'),
        (error) => {
          should(error.message).containEql('line up one to one');
          should(error.message).containEql('nothing was recorded');
        },
    );
  });

  it('keeps SKUs and quantities aligned when a line item has no SKU', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    const result = await run({skus: ',CG-B1700RCVMER', quantities: '5,2'});

    should(result.lines).have.length(1);
    should(result.lines[0].bottles).equal(2);
  });

  it('skips an order that is not a paid, uncancelled order', async () => {
    const cases = [
      [{financialStatus: 'REFUNDED'}, 'skipped_refunded'],
      [{financialStatus: 'VOIDED'}, 'skipped_voided'],
      [{financialStatus: 'PENDING'}, 'skipped_not_paid'],
      [{cancelledAt: '2026-04-05T00:00:00Z'}, 'skipped_cancelled'],
      [{financialStatus: ''}, 'skipped_status_unknown'],
    ];
    for (const [input, expected] of cases) {
      const result = await run({skus: 'CG-B1700RCVMER', quantities: '2', dryRun: false, ...input});
      should(result.status).equal(expected);
      should(result.lines).be.empty();
    }
    // No InnoVint call was mocked, so none was made.
  });

  it('skips a line InnoVint already has at the same time', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([{id: 'act_1', effectiveAt: EFFECTIVE_AT}]);
    mockAdjustment('act_1', {
      id: 'act_1',
      lotId: 'lot_MER',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: EFFECTIVE_AT,
      deleted: false,
      referenceNumber: 'ref-existing',
    });

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '2', dryRun: false});

    should(result.status).equal('already_recorded');
    should(result.linesAlreadyRecorded).equal(1);
    should(result.lines[0].referenceNumber).equal('ref-existing');
  });

  it('flags a nearby adjustment instead of recording it, and fails a real run', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([{id: 'act_1', effectiveAt: '2026-04-04T20:06:43Z'}]);
    mockAdjustment('act_1', {
      id: 'act_1',
      lotId: 'lot_MER',
      compliance: 'REMOVED_TAXPAID',
      effectiveAt: '2026-04-04T20:06:43Z',
      deleted: false,
      referenceNumber: 'ref-other-order',
    });

    const preview = await run({skus: 'CG-B1700RCVMER', quantities: '2'});
    should(preview.lines[0].result).equal('possible_duplicate');
    should(preview.linesWithProblems).equal(1);

    await run({skus: 'CG-B1700RCVMER', quantities: '2', dryRun: false}).then(
        () => should.fail('expected the run to fail'),
        (error) => {
          should(JSON.parse(error.message).code).equal('ReplayIncomplete');
          should(error.message).containEql('possible_duplicate');
        },
    );
  });

  it('matches a lot only on an exact code', async () => {
    mockLots({'CG-B1600RCVMER': 'lot_MER', 'CG-B1600RCVMER-CR': 'lot_CR', 'CG-B1401ESVMAD-CR': 'lot_MAD_CR'});
    mockActions([]);

    const result = await run({skus: 'CG-B1600RCVMER,CG-B1401ESVMAD', quantities: '1,1'});

    should(lineFor(result, 'CG-B1600RCVMER')).containEql({result: 'would_record', lotId: 'lot_MER'});
    should(lineFor(result, 'CG-B1401ESVMAD')).containEql({result: 'lot_not_found', lotId: null});
  });

  it('rejects a SKU that is not a lot code, and a quantity that is not bottles', async () => {
    const bad = await run({skus: 'CG-{{bundle.authData.apiKey}}', quantities: '1'});
    should(bad.lines[0].result).equal('invalid_sku');

    const quantity = await run({skus: 'CG-B1700RCVMER', quantities: 'two'});
    should(quantity.lines[0].result).equal('invalid_quantity');
    should(quantity.linesWithProblems).equal(1);
  });

  it('rejects an effective time that is not a date, and a missing SKU list', async () => {
    await run({skus: 'CG-B1700RCVMER', quantities: '1', effectiveAt: 'yesterday'}).then(
        () => should.fail('expected a bad effective time to be rejected'),
        (error) => should(error.message).containEql('is not a date and time'),
    );
    await run({skus: '', quantities: ''}).then(
        () => should.fail('expected a missing SKU list to be rejected'),
        (error) => should(error.message).containEql('Line Items Sku'),
    );
  });

  it('rejects a winery id that is not one', async () => {
    await run({skus: 'CG-B1700RCVMER', quantities: '1', wineryId: 'wnry_X/../../v2/x'}).then(
        () => should.fail('expected a bad winery id to be rejected'),
        (error) => should(error.message).containEql('is not an InnoVint winery ID'),
    );
  });

  it('records only when Dry Run is explicitly off', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions([]);

    const typo = await run({skus: 'CG-B1700RCVMER', quantities: '1', dryRun: 'Y'});
    should(typo.dryRun).be.true();
    should(typo.linesRecorded).equal(0);

    nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`)
        .reply(201, {data: {referenceNumber: 'ref-1'}});
    const real = await run({skus: 'CG-B1700RCVMER', quantities: '1', dryRun: 'false'});
    should(real.linesRecorded).equal(1);
  });

  it('gives up rather than checking hundreds of actions for one line', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    mockActions(Array.from({length: MAX_DETAIL_LOOKUPS + 1}, (item, index) => ({
      id: `act_${index}`,
      effectiveAt: new Date(Date.parse(EFFECTIVE_AT) + index * 1000).toISOString(),
    })));

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '1'});

    should(result.lines[0].result).equal('error');
    should(result.lines[0].error).containEql('too many to check');
  });

  it('does not follow an InnoVint redirect', async () => {
    const elsewhere = nock('https://attacker.example').get(/.*/).query(true).reply(200, {});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(302, '', {location: 'https://attacker.example/api/v1/lots'});

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '1'});

    should(result.lines[0].result).equal('error');
    should(result.lines[0].error).containEql('redirect');
    should(elsewhere.isDone()).be.false();
  });

  it('refuses a page link that points away from InnoVint', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    const elsewhere = nock('https://attacker.example').get(/.*/).query(true).reply(200, {});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {results: [], pagination: {next: 'https://attacker.example/api/v1/wineries/x/actions'}});

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '1'});

    should(result.lines[0].error).containEql('Refusing');
    should(elsewhere.isDone()).be.false();
  });

  it('waits out InnoVint throttling', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(429, {errors: [{code: 'THROTTLED'}]}, {'retry-after': '0'});
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {results: [{data: {id: 'lot_MER', code: 'CG-B1700RCVMER'}}], pagination: {next: null}});
    mockActions([]);

    const result = await run({skus: 'CG-B1700RCVMER', quantities: '1'});

    should(result.lines[0]).containEql({result: 'would_record', lotId: 'lot_MER'});
  });
});
