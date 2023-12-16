/**
 * Retrieves the ID of a case goods lot from the API.
 *
 * @param {Object} z - The Zapier core object.
 * @param {Object} bundle - The Zapier bundle object.
 * @return {Promise} - A promise that resolves to an array with the lot ID object.
 * @throws {Error} - Throws an error for invalid JSON response or unexpected status codes.
 */
const getCaseGoodsLotId = async (z, bundle) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Access-Token ${bundle.authData.accessToken}`,
  };

  const url = `https://sutter.innovint.us/api/v1/wineries/${bundle.inputData.wineryId}/lots`;
  const responseData = await z.request(url, 'GET',
      {limit: 1, q: bundle.inputData.caseGoodsName}, headers);

  if (responseData) {
    if (responseData.status === 200) {
      // Check if the responseData.data is undefined (invalid JSON response)
      if (!responseData.data) {
        throw new Error('Invalid JSON response');
      }

      // Handle a successful response (HTTP 200)
      const lotData = responseData.data.results[0]?.data;
      if (lotData && lotData.id) {
        return [{id: lotData.id}]; // Return an array with the lot ID object
      } else {
        throw new Error(
            'No lot found with the provided name, or the data structure is unexpected.');
      }
    } else if (responseData.status === 400) {
      // Handle a Bad Request (HTTP 400) response
      if (responseData.data && responseData.data.errors &&
          responseData.data.errors.length > 0) {
        const firstError = responseData.data.errors[0];
        const errorMessage = firstError.details || 'Bad Request';
        throw new Error(errorMessage);
      } else {
        throw new Error('Bad Request: The request parameters are invalid.');
      }
    } else if (responseData.status === 500) {
      // Handle a Server Error (HTTP 500) response
      if (responseData.data && responseData.data.errors &&
          responseData.data.errors.length > 0) {
        const firstError = responseData.data.errors[0];
        const errorMessage = firstError.details || 'Internal Server Error';
        throw new Error(errorMessage);
      } else {
        throw new Error(
            'Internal Server Error: An internal server error occurred.');
      }
    } else {
      // Handle other response status codes if needed
      throw new Error(`Request failed with status ${responseData.status}`);
    }
  } else {
    // Handle unexpected response data (null or undefined)
    throw new Error('Unexpected response data from the API.');
  }
};

module.exports = {
  key: 'getCaseGoodsLotId',
  noun: 'Lot ID',
  display: {
    label: 'Get Lot By Case Goods Name',
    description: 'Gets a lot ID based on the provided case goods name.',
  },
  operation: {
    perform: getCaseGoodsLotId,
    inputFields: [
      {key: 'wineryId', required: true, type: 'string'},
      {key: 'caseGoodsName', required: true, type: 'string'},
    ],
    sample: {id: 'lot_Z1LPW8OQMY23L6QM3KXJD45Y'},
  },
};
