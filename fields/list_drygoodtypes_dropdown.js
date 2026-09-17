'use strict';

const {dropdownTrigger} = require('../lib/dropdown');

module.exports = dropdownTrigger({
  key: 'listDryGoodTypesDropdown',
  noun: 'Dry Good Type',
  label: 'List Dry Good Types',
  description: 'Trigger for field dropdown of Dry Good Types.',
  path: 'dryGoodTypes',
});
