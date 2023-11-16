const listDryGoodTypesDropdown = async (z, bundle) => {
  let drygoodtypes = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/dryGoodTypes';

  while (nextPageUrl) {
    const response = await z.request({
      url: nextPageUrl,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Access-Token ${bundle.authData.accessToken}`,
      },
    });

    const responseData = response.json;
    const pageDryGoods = responseData.results.map((item) => ({
      id: item.data.id,
      name: item.data.name,
      category: item.data.category,
      units: {
        all: item.data.units.all || [],
        liquid: item.data.units.liquid || [],
        dry: item.data.units.dry || [],
      },
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
