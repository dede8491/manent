const expoConfig = require('eslint-config-expo/flat');

/** Globales fournies par Jest, pour les tests et le fichier de configuration. */
const jestGlobals = {
  jest: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
};

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'supabase/functions/**', '.expo/**', 'dist/**'],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', 'jest.setup.js'],
    languageOptions: { globals: jestGlobals },
  },
];
