// ESLint flat config. Enforces the naming standards in ROADMAP.md section 5b:
// no abbreviations or single-letter names (only `id` is allowed as a short name) and camelCase identifiers.
import eslintJavaScript from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  eslintJavaScript.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'id-length': ['error', { min: 3, exceptions: ['id'] }],
      // Database rows use snake_case column names (business_id); property access is exempt.
      camelcase: ['error', { properties: 'never' }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
];
