'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');
const {MAX_DETAIL_LOOKUPS} = require('../../../lib/innovint');

const appTester = zapier.createAppTester(App);
const INNOVINT = 'https://sutter.innovint.us';
const WINERY = 'wnry_TESTWINERY000000000000000';
const EFFECTIVE_AT = '2026-09-05T22:16:16Z';

const run = (inputData) => appTester(App.creates.createCaseGoodsAdjustment.operation.perform, {
  authData: {apiKey: 'innovint-test-key'},
  inputData: {
    wineryId: WINERY,
    compliance: 'REMOVED_TAXPAID',
    effectiveAt: EFFECTIVE_AT,
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

const mockNoActions = () => nock(INNOVINT)
    .persist()
    .get(`/api/v1/wineries/${WINERY}/actions`)
    .query(true)
    .reply(200, {results: [], pagination: {next: null}});

describe('createCaseGoodsAdjustment', () => {
  it('records one adjustment per CG- name and ignores the rest', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER', 'CG-B2102RCVCHA': 'lot_CHA'});
    mockNoActions();
    const bodies = [];
    nock(INNOVINT)
        .persist()
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`, (body) => {
          bodies.push(body);
          return true;
        })
        .reply(201, () => ({data: {referenceNumber: `ref-${bodies.length}`}}));

    const result = await run({
      caseGoodsNames: 'Private Wine Tasting,CG-B1700RCVMER,CG-B2102RCVCHA',
      bottleQuantities: '3,2,1',
    });

    should(result.referenceNumbers).eql(['ref-1', 'ref-2']);
    should(result.skippedNames).eql(['Private Wine Tasting']);
    should(bodies.map((body) => body.data.lotId)).eql(['lot_MER', 'lot_CHA']);
    should(bodies.map((body) => body.data.bottleChanges.bottles)).eql([2, 1]);
    should(bodies[0].data.effectiveAt).equal(EFFECTIVE_AT);
  });

  it('records nothing when the names and quantities do not line up', async () => {
    await run({caseGoodsNames: 'CG-B1700RCVMER,CG-B2102RCVCHA', bottleQuantities: '2'}).then(
        () => should.fail('expected mismatched lists to be rejected'),
        (error) => {
          should(error.message).containEql('line up one to one');
          should(error.message).containEql('nothing was recorded');
        },
    );
  });

  it('records nothing when one lot code is missing', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});

    await run({caseGoodsNames: 'CG-B1700RCVMER,CG-B9999NOPE', bottleQuantities: '1,1'}).then(
        () => should.fail('expected a missing lot to be rejected'),
        (error) => {
          should(error.message).containEql('CG-B9999NOPE');
          should(error.message).containEql('Nothing was recorded');
        },
    );
    // No POST was mocked, so nothing was recorded.
  });

  it('does not record a line InnoVint already has, so a replayed Zap run is safe', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {
          results: [{data: {id: 'act_1', actionType: 'VOLUME_CHANGE', deleted: false, effectiveAt: EFFECTIVE_AT}}],
          pagination: {next: null},
        });
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions/act_1`)
        .reply(200, {
          data: {
            id: 'act_1',
            lotId: 'lot_MER',
            compliance: 'REMOVED_TAXPAID',
            effectiveAt: EFFECTIVE_AT,
            deleted: false,
            referenceNumber: 'ref-existing',
          },
        });

    const result = await run({caseGoodsNames: 'CG-B1700RCVMER', bottleQuantities: '1'});

    should(result.referenceNumbers).eql([]);
    should(result.alreadyRecorded).eql(['ref-existing']);
  });

  it('still records a sale of the same wine at a different time', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {
          results: [{data: {
            id: 'act_1',
            actionType: 'VOLUME_CHANGE',
            deleted: false,
            effectiveAt: '2026-09-05T22:15:20Z',
          }}],
          pagination: {next: null},
        });
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions/act_1`)
        .reply(200, {
          data: {
            id: 'act_1',
            lotId: 'lot_MER',
            compliance: 'REMOVED_TAXPAID',
            effectiveAt: '2026-09-05T22:15:20Z',
            deleted: false,
            referenceNumber: 'ref-earlier-order',
          },
        });
    nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`)
        .reply(201, {data: {referenceNumber: 'ref-new'}});

    const result = await run({caseGoodsNames: 'CG-B1700RCVMER', bottleQuantities: '1'});

    // A minute apart is a second sale, not the same one recorded twice.
    should(result.referenceNumbers).eql(['ref-new']);
    should(result.alreadyRecorded).eql([]);
  });

  it('records even when the duplicate check cannot finish', async () => {
    mockLots({'CG-B1700RCVMER': 'lot_MER'});
    // A crowded window: more actions within two minutes than the check will read.
    nock(INNOVINT)
        .persist()
        .get(`/api/v1/wineries/${WINERY}/actions`)
        .query(true)
        .reply(200, {
          results: Array.from({length: MAX_DETAIL_LOOKUPS + 1}, (item, index) => ({data: {
            id: `act_${index}`,
            actionType: 'VOLUME_CHANGE',
            deleted: false,
            effectiveAt: new Date(Date.parse(EFFECTIVE_AT) + index * 1000).toISOString(),
          }})),
          pagination: {next: null},
        });
    nock(INNOVINT)
        .post(`/api/v1/wineries/${WINERY}/actions/caseGoodsAdjustmentActions`)
        .reply(201, {data: {referenceNumber: 'ref-new'}});

    const result = await run({caseGoodsNames: 'CG-B1700RCVMER', bottleQuantities: '1'});

    // A removal that cannot be checked still has to be recorded.
    should(result.referenceNumbers).eql(['ref-new']);
  });

  it('rejects a quantity that is not a whole number of bottles', async () => {
    await run({caseGoodsNames: 'CG-B1700RCVMER', bottleQuantities: 'two'}).then(
        () => should.fail('expected a bad quantity to be rejected'),
        (error) => should(error.message).containEql('is not a bottle quantity'),
    );
  });
});
