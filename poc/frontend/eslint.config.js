// ESLint 9 flat config
import js from '@eslint/js';
import pluginImport from 'eslint-plugin-import';

export default [
  // Ignore build and dependencies
  {
    ignores: ['dist/**', 'node_modules/**']
  },

  // Base JavaScript rules for ESM in browser
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        // Browser timers and animation
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        // Web APIs commonly used in code
        sessionStorage: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        atob: 'readonly'
      }
    },
    plugins: {
      import: pluginImport
    },
    rules: {
      // Recommended base rules
      ...js.configs.recommended.rules,

      // Import ordering similar to what we enforced before
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ],

      // Hygiene
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error'
    }
  }
];
