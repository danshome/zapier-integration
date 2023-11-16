const listAnalysisTypesDropdown = async (z, bundle) => {
  let analysistypes = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/analysisTypes';

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
    const pageAnalysisTypes = responseData.results.map((item) => ({
      id: item.data.slug, // Use 'slug' as the 'id'
      name: item.data.name,
      abbreviation: item.data.abbreviation,
      units: item.data.units.map((unit) => unit.name).join(', '),
    }));

    analysistypes = [...analysistypes, ...pageAnalysisTypes];
    nextPageUrl = responseData.pagination.next;
  }

  return analysistypes;
};

module.exports = {
  key: 'listAnalysisTypesDropdown',
  noun: 'Analysis Type',
  display: {
    label: 'List Analysis Types',
    description: 'Trigger for field dropdown of Analysis Types.',
    hidden: true,
  },
  operation: {
    perform: listAnalysisTypesDropdown,
  },
};
