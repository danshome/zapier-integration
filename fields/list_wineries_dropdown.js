'use strict';

const {dropdownTrigger} = require('../lib/dropdown');

module.exports = dropdownTrigger({
  key: 'listWineriesDropdown',
  noun: 'Winery',
  label: 'List Wineries',
  description: 'Trigger for field dropdown of Wineries.',
  path: 'wineries',
  operation: {
    inputFields: [
      {
        key: 'wineryId',
        label: 'Select a Winery',
        type: 'string',
        dynamic: 'listWineriesDropdown.id.label',
      },
    ],
    canPaginate: true,
  },
});
