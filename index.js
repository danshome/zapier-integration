const {
  config: authentication,
  befores = [],
  afters = [],
} = require('./authentication');

// Actions

// Searches

// Fields
const listWineriesDropdown =
    require('./fields/list_wineries_dropdown');
const listAppellationsDropdown =
    require('./fields/list_appellations_dropdown');
const listVarietalsDropdown =
    require('./fields/list_varietals_dropdown');
const listAnalysisTypesDropdown =
    require('./fields/list_analysistypes_dropdown');
const listDryGoodsDropdown =
    require('./fields/list_drygoodtypes_dropdown');


// Triggers

// Resources

const App = {
  // This is just shorthand to reference the installed dependencies you have.
  // Zapier will need to know these before we can upload
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,

  // beforeRequest & afterResponse are optional hooks into the provided HTTP
  // client
  beforeRequest: [...befores],

  afterResponse: [...afters],

  // If you want to define optional resources to simplify creation of triggers,
  // searches, creates - do that here!
  resources: {},

  // If you want your trigger to show up, you better include it here!
  triggers: {
    [listWineriesDropdown.key]: listWineriesDropdown,
    [listAppellationsDropdown.key]: listAppellationsDropdown,
    [listVarietalsDropdown.key]: listVarietalsDropdown,
    [listAnalysisTypesDropdown.key]: listAnalysisTypesDropdown,
    [listDryGoodsDropdown.key]: listDryGoodsDropdown,
  },

  // If you want your searches to show up, you better include it here!
  searches: {},

  // If you want your creates to show up, you better include it here!
  creates: {},
};

// Finally, export the app.
module.exports = App;
