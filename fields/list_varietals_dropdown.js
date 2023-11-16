const listVarietalsDropdown = async (z, bundle) => {
  let varietals = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/varietals';

  while (nextPageUrl) {
    const response = await z.request({
      url: nextPageUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Access-Token ${bundle.authData.accessToken}`,
      },
    });

    // Assuming the structure of the response is as you described
    const responseData = response.json;
    const pageVarietals = responseData.results.map((item) => ({
      id: item.data.id,
      name: item.data.name,
      color: item.data.color,
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
