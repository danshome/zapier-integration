/**
 * Retrieves a list of dry goods types from the Sutter API.
 *
 * @param {Object} z - The underlying Zapier `z` object.
 * @param {Object} bundle - The Zapier `bundle` object with authentication data.
 * @return {Array} - An array of dry goods types with their respective properties.
 */
const listDryGoodTypesDropdown = async (z, bundle) => {
  let drygoodtypes = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/dryGoodTypes';

  while (nextPageUrl) {
    const response = await z.request({
      url: nextPageUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Access-Token ${bundle.authData.apiKey}`,
      },
    });

    response.throwForStatus();
    const responseData = await response.json;

    const pageDryGoods = responseData.results.map((item) => ({
      id: item.data.id,
      name: item.data.name,
    }));

    drygoodtypes = [...drygoodtypes, ...pageDryGoods];
    nextPageUrl = responseData.pagination.next;
  }

  return drygoodtypes;
};

module.exports = {
  key: 'listDryGoodTypesDropdown',
  noun: 'Dry Good Type',
  display: {
    label: 'List Dry Good Types',
    description: 'Trigger for field dropdown of Dry Good Types.',
    hidden: true,
  },
  operation: {
    perform: listDryGoodTypesDropdown,
  },
};
