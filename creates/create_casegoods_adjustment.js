const perform = async (z, bundle) => {
  const lotId = await z.searches.get_lotid.perform(z, bundle);

  const options = {
    url: `https://sutter.innovint.us/api/v1/wineries/${bundle.inputData.wineryId}/actions/caseGoodsAdjustmentActions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Access-Token ${bundle.authData.api_key}`,
    },
    body: JSON.stringify({
      'data': {
        'bottleChanges': {
          'bottles': bundle.inputData.bottles,
          'cases': 0,
          'pallets': 0,
        },
        'compliance': bundle.inputData.compliance,
        'lotId': lotId.id, // Use the retrieved lotId
        'effectiveAt': bundle.inputData.effectiveAt,
      },
    }),
  };

  const response = await z.request(options);
  response.throwForStatus();
  const results = response.json;

  if (!results || !results.data || !results.data.referenceNumber) {
    throw new Error('Unexpected API response format');
  }

  return {referenceNumber: results.data.referenceNumber};
};

module.exports = {
  key: 'someAction',
  noun: 'Action',
  display: {
    label: 'Perform Some Action',
    description: 'Performs an action using the Lot ID.',
  },
  operation: {
    perform,
    inputFields: [
      // Define your input fields here
    ],
    sample: {
      referenceNumber: 'example_ref_number',
    },
  },
};
