'use strict';

const nock = require('nock');

// Unit tests must never reach a real API: an unmatched request is a bug.
exports.mochaHooks = {
  beforeAll() {
    nock.disableNetConnect();
  },
  afterEach() {
    nock.cleanAll();
  },
  afterAll() {
    nock.enableNetConnect();
  },
};
