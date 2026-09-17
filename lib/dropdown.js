'use strict';

const {BASE_URL, listAllPages} = require('./innovint');

/**
 * Builds a hidden trigger that fills a dropdown from an InnoVint list endpoint.
 *
 * Every page is read through the shared InnoVint client, which keeps the API
 * key on InnoVint hosts, waits out rate limiting and refuses a page link that
 * points anywhere else.
 *
 * @param {Object} config - Dropdown definition.
 * @param {string} config.key - Trigger key.
 * @param {string} config.noun - Trigger noun.
 * @param {string} config.label - Trigger label.
 * @param {string} config.description - Trigger description.
 * @param {string} config.path - InnoVint API path, e.g. "varietals".
 * @param {string} [config.idField] - Field of the item to use as the id.
 * @param {Object} [config.operation] - Extra operation properties.
 * @return {Object} A Zapier trigger.
 */
const dropdownTrigger = ({key, noun, label, description, path, idField = 'id', operation = {}}) => ({
  key,
  noun,
  display: {label, description, hidden: true},
  operation: {
    ...operation,
    perform: async (z, bundle) => {
      const items = await listAllPages(z, `${BASE_URL}/${path}`);
      return items
          .filter((item) => item && item[idField])
          .map((item) => ({id: item[idField], name: item.name}));
    },
  },
});

module.exports = {dropdownTrigger};
