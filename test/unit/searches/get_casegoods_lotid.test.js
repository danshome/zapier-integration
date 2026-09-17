'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');

const appTester = zapier.createAppTester(App);
const INNOVINT = 'https://sutter.innovint.us';
const WINERY = 'wnry_TESTWINERY000000000000000';

const run = (caseGoodsName, wineryId = WINERY) =>
  appTester(App.searches.getCaseGoodsLotId.operation.perform, {
    authData: {apiKey: 'innovint-test-key'},
    inputData: {wineryId, caseGoodsName},
  });

describe('getCaseGoodsLotId', () => {
  it('returns the lot whose code matches exactly', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query({codeIn: 'CG-B1600RCVMER', archived: 'false', limit: '10'})
        .reply(200, {
          results: [
            {data: {id: 'lot_CR', code: 'CG-B1600RCVMER-CR'}},
            {data: {id: 'lot_MER', code: 'CG-B1600RCVMER'}},
          ],
          pagination: {next: null},
        });

    should(await run('CG-B1600RCVMER')).eql([{id: 'lot_MER'}]);
  });

  it('returns nothing rather than a lot with a longer code', async () => {
    const onlySibling = {
      results: [{data: {id: 'lot_CR', code: 'CG-B1401ESVMAD-CR'}}],
      pagination: {next: null},
    };
    nock(INNOVINT).get(`/api/v1/wineries/${WINERY}/lots`).query(true).reply(200, onlySibling);
    nock(INNOVINT).get(`/api/v1/wineries/${WINERY}/lots`).query(true).reply(200, onlySibling);

    should(await run('CG-B1401ESVMAD')).eql([]);
  });

  it('passes an InnoVint error through as a readable failure', async () => {
    nock(INNOVINT)
        .get(`/api/v1/wineries/${WINERY}/lots`)
        .query(true)
        .reply(400, {errors: [{code: 'VALIDATION_ERROR', details: 'The request input data was invalid.'}]});

    await run('CG-B1700RCVMER').then(
        () => should.fail('expected the error to be raised'),
        (error) => should(JSON.parse(error.message).status).equal(400),
    );
  });

  it('rejects a winery id that is not one', async () => {
    await run('CG-B1700RCVMER', 'not-a-winery').then(
        () => should.fail('expected a bad winery id to be rejected'),
        (error) => should(error.message).containEql('is not an InnoVint winery ID'),
    );
  });

  it('rejects an empty case goods name', async () => {
    await run('  ').then(
        () => should.fail('expected an empty name to be rejected'),
        (error) => should(error.message).containEql('Enter a case goods name'),
    );
  });
});
