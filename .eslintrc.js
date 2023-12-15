module.exports = {
  'env': {
    'commonjs': true,
    'es2021': true,
    'node': true,
    'mocha': true,
  },
  'extends': ['eslint:recommended', 'google'],
  'overrides': [
    {
      'env': {
        'node': true,
      },
      'files': [
        '.eslintrc.{js,cjs}',
      ],
      'parserOptions': {
        'sourceType': 'script',
      },
    },
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
  },
  'rules': {
    'max-len': ['error', 120],
  },
};
