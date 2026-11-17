// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['node_modules/*', 'coverage/*', '.expo/*', 'dist/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
    },
  },
  {
    files: ['__tests__/**/*', 'jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
