/**
 * The base URL for the wineries API.
 *
 * @type {string}
 */
const BASE_URL = 'https://sutter.innovint.us/api/v1/wineries';

/**
 * Makes an asynchronous HTTP request using the provided parameters
 *
 * @param {object} z - The instance of the currently running Zapier app
 * @param {string} url - The URL to which the request will be sent
 * @param {string} method - The HTTP method to be used for the request, e.g. 'GET', 'POST', etc.
 * @param {object} params - The parameters to be included with the request
 * @param {object} headers - The headers to be included with the request
 *
 * @return {Promise<object>} - A Promise that resolves to the JSON data returned by the API
 */
async function request(z, url, method, params, headers) {
  const response = await z.request(url, {method, params, headers});
  response.throwForStatus();
  return response.json();
}

/**
 * Retrieves lot data by case goods name.
 *
 * @async
 * @param {object} z - The z object provided by Zapier.
 * @param {object} bundle - The bundle object provided by Zapier.
 * @return {Promise<object>} - A promise that resolves to the lot data.
 * @throws {Error} - If no lot is found with the provided name, or the data structure is unexpected.
 *
 * @requires request
 */
const getLotByCaseGoodsName = async (z, bundle) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Access-Token ${bundle.authData.accessToken}`,
  };
  const url = `${BASE_URL}/${bundle.inputData.wineryId}/lots`;
  const response = await request(z, url, 'GET',
      {limit: 1, q: bundle.inputData.caseGoodsName}, headers);
  const lotData = response.results[0]?.data;
  if (!lotData || !lotData.id) {
    throw new Error(
        'No lot found with the provided name, ' +
        'or the data structure is unexpected.');
  }
  return {id: lotData.id};
};

module.exports = {
  key: 'getLotByCaseGoodsName',
  noun: 'Lot ID',
  display: {
    label: 'Get Lot By Case Goods Name',
    description: 'Gets a lot ID based on the provided case goods name.',
  },
  operation: {
    perform: getLotByCaseGoodsName,
    inputFields: [
      {key: 'wineryId', required: true, type: 'string'},
      {key: 'caseGoodsName', required: true, type: 'string'},
    ],
    sample: {id: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y'},
  },
};


