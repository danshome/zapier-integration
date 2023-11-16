const zapier = require('zapier-platform-core');
const nock = require('nock');
const should = require('should');
const App = require('../../../index');
const appTester = zapier.createAppTester(App);
const {bundle} = require('../../_bundle');
const listAnalysisTypes = require(
    '../../../fields/list_analysistypes_dropdown');

describe('List Analysis Types Trigger', () => {
  zapier.tools.env.inject();

  it('should load dry good types data', async () => {
    nock('https://sutter.innovint.us')
        .get('/api/v1/analysisTypes')
        .reply(200,
            {
              'results': [
                {
                  'data': {
                    'name': 'Wine Color Density',
                    'abbreviation': 'Color-Density',
                    'slug': 'wine-color-density',
                    'units': [
                      {
                        'name': 'Absorbance Units',
                        'unit': 'AU',
                      },
                    ],
                  },
                  'relationships': {},
                },
                {
                  'data': {
                    'name': 'Nitrogen',
                    'abbreviation': '',
                    'slug': 'nitrogen',
                    'units': [
                      {
                        'name': 'Milligrams per Liter',
                        'unit': 'mg/L',
                      },
                      {
                        'name': 'Parts per Million',
                        'unit': 'ppm',
                      },
                    ],
                  },
                  'relationships': {},
                },
              ],
              'pagination': {
                'count': 402,
                'next': null,
                'previous': 'https://sutter.innovint.us/api/v1/analysisTypes',
              },
            },
        );

    const results = await appTester(listAnalysisTypes.operation.perform,
        bundle);

    should(results).containEql({
      id: 'wine-color-density',
      name: 'Wine Color Density',
      abbreviation: 'Color-Density',
      units: 'Absorbance Units',
    });

    should(results).containEql({
      id: 'nitrogen',
      name: 'Nitrogen',
      abbreviation: '',
      units: 'Milligrams per Liter, Parts per Million',
    });
  });
});
