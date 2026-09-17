'use strict';

const {dropdownTrigger} = require('../lib/dropdown');

module.exports = dropdownTrigger({
  key: 'listVarietalsDropdown',
  noun: 'Varietal',
  label: 'List Varietals',
  description: 'Trigger for field dropdown of Varietals.',
  path: 'varietals',
});
