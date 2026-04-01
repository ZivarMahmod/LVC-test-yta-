import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        XMLHttpRequest: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        navigator: 'readonly',
        Buffer: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        history: 'readonly',
        location: 'readonly',
        crypto: 'readonly',
        prompt: 'readonly',
        Image: 'readonly'
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Kodkvalitet
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Ej för strikt — låt Prettier hantera formatering
      'no-trailing-spaces': 'off',
      'semi': 'off',
      'quotes': 'off'
    }
  },
  {
    ignores: ['dist/', 'node_modules/', 'src/pages/AdminPage.jsx']
  }
];
