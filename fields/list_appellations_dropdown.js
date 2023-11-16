const listAppellationsDropdown = async (z, bundle) => {
  let appellations = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/appellations';

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
