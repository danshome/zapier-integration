const list_wineries = (z, bundle, url) => {
  const options = {
    url: url,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Access-Token ${bundle.authData.accessToken}`
    }
  };

  return z.request(options)
  .then((response) => {
    response.throwForStatus();
    const results = response.json;

    const pageWineryIds = results.results.map(winery => ({ id: winery.data.internalId.toString() }));

    // If there's a next page, recursively fetch it
    if (results.pagination.next) {
      return list_wineries(z, bundle, results.pagination.next).then(nextPageWineryIds => pageWineryIds.concat(nextPageWineryIds));
    } else {
      return pageWineryIds;
    }
  });
};

module.exports = {
  key: 'list_wineries',
  noun: 'Winery',
  display: {
    label: 'List Wineries',
    description: 'Returns a list of wineries.',
    hidden: true
  },
  operation: {
    perform: (z, bundle) => list_wineries(z, bundle, 'https://sutter.innovint.us/api/v1/wineries')
  },
};
