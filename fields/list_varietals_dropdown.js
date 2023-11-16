const listVarietals = async (z, bundle) => {
  const response = await z.request({
    url: 'https://sutter.innovint.us/api/v1/varietals',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Access-Token ${bundle.authData.accessToken}`,
    },
  });

  return response.json.map((appellation) => ({
    id: appellation.id,
    name: appellation.name,
  }));
};

module.exports = {
  key: 'listVarietals',
  noun: 'Varietals',
  display: {
    label: 'List Varietals',
    description: 'Triggers when a new varietal is added.',
    hidden: true,
  },
  operation: {
    perform: listVarietals,
  },
};
