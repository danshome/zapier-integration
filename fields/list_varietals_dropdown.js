/**
 * Fetches a list of varietals from the specified API endpoint.
 *
 * @async
 * @param {Object} z - The z object provided by the Zapier platform.
 * @param {Object} bundle - The bundle object provided by the Zapier platform.
 * @return {Promise<Object[]>} - A promise that resolves to an array of varietals.
 */
const listVarietalsDropdown = async (z, bundle) => {
  let varietals = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/varietals';

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

    const pageVarietals = responseData.results.map((item) => ({
      id: item.data.id,
      name: item.data.name,
    }));

    varietals = [...varietals, ...pageVarietals];
    nextPageUrl = responseData.pagination.next;
  }

  return varietals;
};

module.exports = {
  key: 'listVarietalsDropdown',
  noun: 'Varietal',
  display: {
    label: 'List Varietals',
    description: 'Trigger for field dropdown of Varietals.',
    hidden: true,
  },
  operation: {
    perform: listVarietalsDropdown,
  },
};
