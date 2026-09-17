'use strict';

const {dropdownTrigger} = require('../lib/dropdown');

module.exports = dropdownTrigger({
  key: 'listAnalysisTypesDropdown',
  noun: 'Analysis Type',
  label: 'List Analysis Types',
  description: 'Trigger for field dropdown of Analysis Types.',
  path: 'analysisTypes',
  idField: 'slug',
});
