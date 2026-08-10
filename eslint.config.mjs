// ESLint flat config. This is the CI authority (`pnpm lint:ci`); `.oxlintrc.json`
// is the fast local subset and MUST stay a subset of the rules below, so
// `pnpm lint` never fails on code `pnpm lint:ci` accepts.
//
// There is no TypeScript in this repo and therefore no `typecheck` script: the
// plugin is content, and the three validation scripts are plain Node ESM. If a
// script ever grows enough to want types, add TS and the type-aware config from
// the sibling repos rather than bolting `checkJs` onto this.

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'scripts/schemas/**', 'scripts/fixtures/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Leading underscore marks a deliberately unused binding, matching the
      // convention in the sibling repos.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // These scripts ARE command-line reporters: their output is the product.
      'no-console': 'off',

      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',

      // Present because oxlint's `correctness` category enforces this and the
      // subset invariant above requires eslint to be at least as strict. Without
      // it, `pnpm lint` failed on code `pnpm lint:ci` accepted, which is exactly
      // the situation that invariant exists to prevent. It bites on a ternary
      // evaluated for its side effect; the validators use an `expect()` helper
      // instead so the ternary sits in an argument.
      'no-unused-expressions': 'error',
    },
  },
];
