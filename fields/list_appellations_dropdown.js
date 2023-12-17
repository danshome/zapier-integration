/**
 * Retrieves a list of appellations from a REST API.
 *
 * @async
 * @param {Object} z - The z object from the zapier library.
 * @param {Object} bundle - The bundle object containing authorization data.
 * @return {Array} - An array of appellations.
 */
const listAppellationsDropdown = async (z, bundle) => {
  let appellations = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/appellations';

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

    const pageAppellations = responseData.results.map((item) => ({
      id: item.data.id,
      name: item.data.name,
    }));

    appellations = [...appellations, ...pageAppellations];
    nextPageUrl = responseData.pagination.next;
  }

  return appellations;
};

module.exports = {
  key: 'listAppellationsDropdown',
  noun: 'Appellation',
  display: {
    label: 'List Appellations',
    description: 'Trigger for field dropdown of Appellations.',
    hidden: true,
  },
  operation: {
    perform: listAppellationsDropdown,
  },
};
