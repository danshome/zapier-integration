'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');

const appTester = zapier.createAppTester(App);
const INNOVINT = 'https://sutter.innovint.us';
const WINERY = 'wnry_TESTWINERY000000000000000';

const run = (inputData = {}) =>
  appTester(App.searches.getCaseGoodsInventory.operation.perform, {
    authData: {apiKey: 'innovint-test-key'},
    inputData: {wineryId: WINERY, ...inputData},
  });

// InnoVint reports full cases plus loose bottles; `bottles` here is the total.
const lot = (code, lotType, bottles, volume, extra = {}) => ({
  data: {
    id: `lot_${code}`, code, lotType, volume, ...extra,
    bottlesOnHand: {cases: Math.floor(bottles / 12), bottles: bottles % 12},
  },
});

describe('getCaseGoodsInventory', () => {
  afterEach(() => should(nock.isDone()).be.true());

  it('returns one result with every case goods lot, sorted by code', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query({archived: 'false', limit: '100'})
        .reply(200, {
          results: [
            lot('CG-B2400RCVCHA', 'CASE_GOODS', 819, {value: 162.266, unit: 'gal'},
                {name: 'B 24 00 RCV CHA', stage: 'UNFINISHED'}),
            lot('CG-B1700RCVMER', 'CASE_GOODS', 899, {value: 674.2, unit: 'L'}),
            lot('B1700RCVMER', 'BULK', 0, {value: 500, unit: 'gal'}),
          ],
          pagination: {next: null},
        });

    const [result] = await run();
    should(result.lotCount).equal(2);
    should(result.lots.map((l) => l.code)).eql(['CG-B1700RCVMER', 'CG-B2400RCVCHA']);
    should(JSON.parse(result.bottlesJson)).eql({'CG-B1700RCVMER': 899, 'CG-B2400RCVCHA': 819});
    should(result.lots[0].gallons).be.approximately(178.1, 0.1);
    should(result.lots[1]).containEql({
      name: 'B 24 00 RCV CHA', stage: 'UNFINISHED', bottles: 819, cases: 68, looseBottles: 3,
      bottlesPerCase: 12, bottleSizeMl: 750, gallons: 162.266,
    });
  });

  it('adds full cases to loose bottles, inferring the case size from the volume', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [
            // 74 cases of 12 + 11 = 899 × 750 ml = 178.12 gal
            {data: {id: 'a', code: 'CG-B1700RCVMER', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 74, bottles: 11}, volume: {value: 178.1166, unit: 'gal'}}},
            // 2 cases of 12 + 1 = 25 × 375 ml = 2.4766 gal
            {data: {id: 'b', code: 'CG-B1401ESVMAD-CR', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 2, bottles: 1}, volume: {value: 2.4766, unit: 'gal'}}},
            // 3 magnums, no cases: 3 × 1.5 L = 1.1888 gal
            {data: {id: 'c', code: 'CG-B1700RCVMER-MAGNUM', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 0, bottles: 3}, volume: {value: 1.1888, unit: 'gal'}}},
            // 10 cases of 6 magnums + 2 loose = 62 × 1.5 L = 24.57 gal
            {data: {id: 'd', code: 'CG-B1702RCVMER-CR-MAGNUM', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 10, bottles: 2}, volume: {value: 24.567, unit: 'gal'}}},
            // 10 full cases and 90 L is the same volume as 120 × 750 ml or 60 × 1.5 L;
            // with nothing to break the tie the count assumes 12 to a case.
            {data: {id: 'f', code: 'CG-AMBIGUOUS-MAGNUM', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 10, bottles: 0}, volume: {value: 23.775, unit: 'gal'}}},
            // no volume at all: assume 12 to a case
            {data: {id: 'e', code: 'CG-B2400RCVCHA', lotType: 'CASE_GOODS',
              bottlesOnHand: {cases: 68, bottles: 0}}},
          ],
          pagination: {next: null},
        });

    const [result] = await run();
    should(JSON.parse(result.bottlesJson)).eql({
      'CG-B1401ESVMAD-CR': 25,
      'CG-B1700RCVMER': 899,
      'CG-B1700RCVMER-MAGNUM': 3,
      'CG-B1702RCVMER-CR-MAGNUM': 62,
      'CG-AMBIGUOUS-MAGNUM': 120,
      'CG-B2400RCVCHA': 816,
    });
    const byCode = Object.fromEntries(result.lots.map((l) => [l.code, l]));
    should(byCode['CG-B1401ESVMAD-CR']).containEql({bottlesPerCase: 12, bottleSizeMl: 375});
    should(byCode['CG-B1702RCVMER-CR-MAGNUM']).containEql({bottlesPerCase: 6, bottleSizeMl: 1500});
    should(byCode['CG-B2400RCVCHA']).containEql({bottlesPerCase: 12, bottleSizeMl: null, gallons: null});
  });

  it('follows pagination and applies a wildcard pattern', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query({archived: 'false', limit: '100'})
        .reply(200, {
          results: [lot('CG-B1500RCVMER', 'CASE_GOODS', 407, {value: 84.799, unit: 'gal'})],
          pagination: {next: `${INNOVINT}/api/v1/wineries/${WINERY}/lots?archived=false&limit=100&offset=100`},
        });
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query({archived: 'false', limit: '100', offset: '100'})
        .reply(200, {
          results: [
            lot('CG-S2301RCVROSE', 'CASE_GOODS', 161, {value: 31.899, unit: 'gal'}),
            lot('MWG-CG-OTHER', 'CASE_GOODS', 5, {value: 1, unit: 'gal'}),
          ],
          pagination: {next: null},
        });

    const [result] = await run({codePattern: 'CG-*'});
    should(result.lots.map((l) => l.code)).eql(['CG-B1500RCVMER', 'CG-S2301RCVROSE']);
  });

  it('matches the whole code against the pattern, ignoring case, with ? for one character', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [
            lot('CG-B2302RCVROSE', 'CASE_GOODS', 279, {value: 55.278, unit: 'gal'}),
            lot('CG-S2301RCVROSE', 'CASE_GOODS', 161, {value: 31.899, unit: 'gal'}),
            lot('CG-B2301RCVCHA', 'CASE_GOODS', 256, {value: 50.721, unit: 'gal'}),
            lot('CG-B1700RCVMER', 'CASE_GOODS', 899, {value: 178.116, unit: 'gal'}),
          ],
          pagination: {next: null},
        });

    const [result] = await run({codePattern: 'cg-?23*rose'});
    should(JSON.parse(result.bottlesJson)).eql({'CG-B2302RCVROSE': 279, 'CG-S2301RCVROSE': 161});
  });

  it('keeps regular-expression characters literal and survives a pathological pattern', async () => {
    const codes = ['CG-(B17)*', 'CG.B17', 'CG-B1700RCVMER-CR-MAGNUM-XXXXXXXXXXXXXXX'];
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .times(3)
        .reply(200, {
          results: codes.map((code) => lot(code, 'CASE_GOODS', 12, {value: 2.378, unit: 'gal'})),
          pagination: {next: null},
        });

    should(JSON.parse((await run({codePattern: 'CG-(B17)*'}))[0].bottlesJson)).eql({'CG-(B17)*': 12});
    should(JSON.parse((await run({codePattern: 'CG.B17'}))[0].bottlesJson)).eql({'CG.B17': 12});

    const started = Date.now();
    const [result] = await run({codePattern: `${'*'.repeat(30)}a*a*a*a*a*a*a*a*ab`});
    should(Date.now() - started).be.below(500);
    should(result.lotCount).equal(0);
  });

  it('rejects a pattern that is absurdly long', async () => {
    await run({codePattern: 'C'.repeat(101)}).then(
        () => should.fail('expected the pattern to be rejected'),
        (error) => should(error.message).containEql('longer than 100'),
    );
  });

  it('adds lots that share a code, keeps __proto__ as a plain key and ignores unknown units', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [
            lot('CG-TWICE', 'CASE_GOODS', 24, {value: 4.755, unit: 'gal'}),
            lot('CG-TWICE', 'CASE_GOODS', 12, {value: 2.378, unit: 'gal'}),
            lot('__proto__', 'CASE_GOODS', 5, {value: 0.99, unit: 'gal'}),
            lot('CG-ODDUNIT', 'CASE_GOODS', 14, {value: 90000, unit: 'oz'}),
          ],
          pagination: {next: null},
        });

    const [result] = await run({codePattern: ''});
    // An object literal with a __proto__ key sets the prototype, so compare entries.
    should(Object.entries(JSON.parse(result.bottlesJson)).sort()).eql(
        [['CG-ODDUNIT', 14], ['CG-TWICE', 36], ['__proto__', 5]]);
    should(result.lotCount).equal(4);
    const odd = result.lots.find((l) => l.code === 'CG-ODDUNIT');
    should(odd).containEql({gallons: null, bottlesPerCase: 12, bottleSizeMl: null});
  });

  it('fails loudly when InnoVint returns a bottle count that is not a number', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [{data: {id: 'x', code: 'CG-BAD', lotType: 'CASE_GOODS',
            bottlesOnHand: {cases: 'seventy', bottles: 1}, volume: {value: 1, unit: 'gal'}}}],
          pagination: {next: null},
        });

    await run().then(
        () => should.fail('expected the bad count to be rejected'),
        (error) => should(error.message).containEql('unreadable bottle count for CG-BAD'),
    );
  });

  it('gives up on the case size when the volume fits no standard bottle', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [{data: {id: 'y', code: 'CG-STALE', lotType: 'CASE_GOODS',
            bottlesOnHand: {cases: 10, bottles: 0}, volume: {value: 500, unit: 'gal'}}}],
          pagination: {next: null},
        });

    const [result] = await run();
    should(result.lots[0]).containEql({bottles: 120, bottlesPerCase: 12, bottleSizeMl: null});
  });

  it('treats a pattern without wildcards as an exact code', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {
          results: [
            lot('CG-B1600RCVMER', 'CASE_GOODS', 898, {value: 177.918, unit: 'gal'}),
            lot('CG-B1600RCVMER-CR', 'CASE_GOODS', 875, {value: 173.362, unit: 'gal'}),
          ],
          pagination: {next: null},
        });

    const [result] = await run({codePattern: 'CG-B1600RCVMER'});
    should(JSON.parse(result.bottlesJson)).eql({'CG-B1600RCVMER': 898});
  });

  it('returns an empty inventory rather than nothing when the winery has no case goods', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(200, {results: [lot('B2100RCVBAR', 'BULK', 0, {value: 60, unit: 'gal'})], pagination: {next: null}});

    const [result] = await run();
    should(result.lotCount).equal(0);
    should(result.bottlesJson).equal('{}');
  });

  it('rejects a winery id that is not one', async () => {
    await run({wineryId: 'not-a-winery'}).then(
        () => should.fail('expected a bad winery id to be rejected'),
        (error) => should(error.message).containEql('is not an InnoVint winery ID'),
    );
  });
});
