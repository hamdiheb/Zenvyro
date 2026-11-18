// ESLint flat config. Copies the naming standards from backend/eslint.config.js (ROADMAP.md section 5b):
// no abbreviations or single-letter names (only `id` is allowed as a short name) and camelCase identifiers.
import eslintJavaScript from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  eslintJavaScript.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Third-party option objects use short keys we do not choose (Vite's `ws`, CSS-in-JS `top`),
      // so object property names are exempt. Every variable, function and parameter name is checked.
      'id-length': ['error', { min: 3, exceptions: ['id'], properties: 'never' }],
      // API payloads may use snake_case keys; property access is exempt.
      camelcase: ['error', { properties: 'never' }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z]' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
