import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      // Code quality
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-debugger': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-console': 'off',

      // Stylistic — warn only, don't block existing code
      'semi': ['warn', 'always'],
      'no-trailing-spaces': 'warn',
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'multi-line']
    }
  },
  {
    ignores: ['node_modules/', 'prisma/migrations/', 'tests/']
  }
];
