import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.svelte-kit/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'playwright.config.ts',
      'reference/**',
      'tests/**',
      '**/*.spec.ts',
      '**/*.test.ts',
      'test-*.ts',
      'eslint.config.js',
      '**/*.svelte',
      'report/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.js', 'src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-case-declarations': 'off',
      'no-useless-catch': 'warn',
      'prefer-const': 'warn',
      "@typescript-eslint/no-inferrable-types": 0,
      // "@typescript-eslint/typedef": [
      //     "warn",
      //     {
      //         "variableDeclaration": true
      //     }
      // ]
    }
  }
];