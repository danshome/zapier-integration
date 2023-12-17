/**
 * Retrieves a list of analysis types from the API.
 *
 * @param {object} z - The 'z' object from Zapier which provides access to built-in actions and resources.
 * @param {object} bundle - The bundle object which contains information about the current Zap instance.
 * @return {array} - An array of analysis types.
 */
const listAnalysisTypesDropdown = async (z, bundle) => {
  let analysistypes = [];
  let nextPageUrl = 'https://sutter.innovint.us/api/v1/analysisTypes';

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

    const pageAnalysisTypes = responseData.results.map((item) => ({
      id: item.data.slug, // Use 'slug' as the 'id'
      name: item.data.name,
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
