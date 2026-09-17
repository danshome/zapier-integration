'use strict';

const nock = require('nock');
const should = require('should');
const zapier = require('zapier-platform-core');

const App = require('../../../index');

const appTester = zapier.createAppTester(App);
const INNOVINT = 'https://sutter.innovint.us';
const bundle = {authData: {apiKey: 'innovint-test-key'}, inputData: {}};

const DROPDOWNS = [
  {key: 'listWineriesDropdown', path: '/api/v1/wineries', idField: 'id'},
  {key: 'listAppellationsDropdown', path: '/api/v1/appellations', idField: 'id'},
  {key: 'listVarietalsDropdown', path: '/api/v1/varietals', idField: 'id'},
  {key: 'listDryGoodTypesDropdown', path: '/api/v1/dryGoodTypes', idField: 'id'},
  {key: 'listAnalysisTypesDropdown', path: '/api/v1/analysisTypes', idField: 'slug'},
];

describe('dropdown triggers', () => {
  DROPDOWNS.forEach(({key, path, idField}) => {
    it(`${key} reads every page`, async () => {
      nock(INNOVINT)
          .get(path)
          .query({limit: 100})
          .reply(200, {
            results: [{data: {[idField]: 'one', name: 'One'}}],
            pagination: {next: `${INNOVINT}${path}?limit=100&offset=100`},
          });
      nock(INNOVINT)
          .get(path)
          .query({limit: 100, offset: 100})
          .reply(200, {results: [{data: {[idField]: 'two', name: 'Two'}}], pagination: {next: null}});

      const results = await appTester(App.triggers[key].operation.perform, bundle);

      should(results).eql([{id: 'one', name: 'One'}, {id: 'two', name: 'Two'}]);
    });
  });

  it('sends the API key and asks for large pages', async () => {
    let headers = null;
    nock(INNOVINT)
        .get('/api/v1/wineries')
        .query({limit: 100})
        .reply(function() {
          headers = this.req.headers;
          return [200, {results: [], pagination: {next: null}}];
        });

    await appTester(App.triggers.listWineriesDropdown.operation.perform, bundle);

    should(headers.authorization).equal('Access-Token innovint-test-key');
  });

  it('refuses a page link that points away from InnoVint', async () => {
    const elsewhere = nock('https://attacker.example').get(/.*/).query(true).reply(200, {});
    nock(INNOVINT)
        .get('/api/v1/wineries')
        .query(true)
        .reply(200, {results: [], pagination: {next: 'https://attacker.example/api/v1/wineries'}});

    await appTester(App.triggers.listWineriesDropdown.operation.perform, bundle).then(
        () => should.fail('expected the off-host page link to be refused'),
        (error) => should(error.message).containEql('Refusing'),
    );
    should(elsewhere.isDone()).be.false();
  });

  it('waits out rate limiting instead of failing', async () => {
    nock(INNOVINT)
        .get('/api/v1/varietals')
        .query(true)
        .reply(429, {errors: [{code: 'THROTTLED'}]}, {'retry-after': '0'});
    nock(INNOVINT)
        .get('/api/v1/varietals')
        .query(true)
        .reply(200, {results: [{data: {id: 'v1', name: 'Merlot'}}], pagination: {next: null}});

    const results = await appTester(App.triggers.listVarietalsDropdown.operation.perform, bundle);

    should(results).eql([{id: 'v1', name: 'Merlot'}]);
  });
});
