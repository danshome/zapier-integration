/**
 * Retrieves a list of wineries for a dropdown.
 * @async
 * @param {Object} z - The 'zapier' object.
 * @param {Object} bundle - The bundle containing additional data.
 * @return {Array} - An array of wineries for the dropdown.
 */
const listWineriesDropdown = async (z, bundle) => {
  let wineries = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/wineries';

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

    const pageWineries = responseData.results.map((winery) => ({
      id: winery.data.id,
      name: winery.data.name,
    }));

    wineries = [...wineries, ...pageWineries];
    nextPageUrl = responseData.pagination.next;
  }

  return wineries;
};

module.exports = {
  key: 'listWineriesDropdown',
  noun: 'Winery',
  display: {
    label: 'List Wineries',
    description: 'Trigger for field dropdown of Wineries.',
    hidden: true,
  },
  operation: {
    inputFields: [
      {
        key: 'wineryId',
        label: 'Select a Winery',
        type: 'string',
        dynamic: 'listWineriesDropdown.id.label',
      },
    ],
    perform: listWineriesDropdown,
    canPaginate: true,
  },
};
