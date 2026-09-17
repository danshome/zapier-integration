'use strict';

const {dropdownTrigger} = require('../lib/dropdown');

module.exports = dropdownTrigger({
  key: 'listAppellationsDropdown',
  noun: 'Appellation',
  label: 'List Appellations',
  description: 'Trigger for field dropdown of Appellations.',
  path: 'appellations',
});
