const listAppellations = async (z, bundle) => {
  const response = await z.request({
    url: 'https://sutter.innovint.us/api/v1/appellations',
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
  key: 'listAppellations',
  noun: 'Appellation',
  display: {
    label: 'List Appellations',
    description: 'Triggers when a new appellation is added.',
    hidden: true,
  },
  operation: {
    perform: listAppellations,
  },
};
