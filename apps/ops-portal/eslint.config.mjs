import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import i18nextPlugin from 'eslint-plugin-i18next';
import reactPlugin from 'eslint-plugin-react';
import jsoncPlugin from 'eslint-plugin-jsonc';
import * as jsoncParser from 'jsonc-eslint-parser';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

export default tseslint.config(
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'eslint.config.mjs', '**/lib/api.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc: jsoncPlugin,
    },
    rules: {
      'jsonc/no-dupe-keys': 'error',
      'jsonc/sort-keys': [
        'warn',
        {
          pathPattern: '^.*$',
          order: { type: 'asc' },
        },
      ],
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    plugins: {
      i18next: i18nextPlugin,
      react: reactPlugin,
      '@eslint-community/eslint-comments': eslintComments
    },
    rules: {
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: ['eslint-enable'] }],
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-text-only',
        'jsx-attributes': {
          exclude: ['className', 'styleName', 'style', 'type', 'key', 'id', 'width', 'height', 'aria-hidden'],
        },
        words: {
          exclude: [
            /[0-9!\-\/:\-@\[-`{-~]+/,
            /[A-Z_-]+/,
            /^[\p{Emoji}\p{Emoji_Component}\uFE0E\uFE0F\u200D\s✅🚚❌📦]+$/u,
            /^use client$/,
            /^([a-z]+_[a-z_]+|info|group|delete|edit|phone|smartphone|mail|payments|print|check|settings)$/,
            /^[—\-\.\+←→·%\$\(\)\"\'\,\s\&×•]+$/,
            /^(&times;|&bull;)$/
          ]
        }
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@/lib/api',
          importNames: ['apiFetch', 'apiMutate'],
          message: 'ADV-080: Use the generated SDK @herobm/sdk instead of manual apiFetch or apiMutate.'
        }]
      }],
      '@typescript-eslint/no-unused-vars': 'off',
      'react/jsx-key': 'error',
      
      // ADV-029: Centralized Observability Reporting - Ban direct console.error
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
          message: "ADV-029: Use reportError() instead of console.error() to ensure centralized observability reporting."
        },
        // ADV-034: No Hardcoded Currency near amounts
        {
          selector: "Literal[value=/€/], TemplateElement[value.raw=/€/]",
          message: "Do not hardcode currency symbols. Use the formatted amount from the backend or the shared currency formatter."
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "ADV-041: Do not use raw fetch(). Use apiFetch(), apiMutate(), or apiFetchBlob() from @/lib/api to ensure consistent authentication and error handling."
        },
        {
          selector: ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > Literal[value=/[a-zA-Z]/]",
          message: "ADV-071: Do not use hardcoded string literals inside JSX expressions. Use useTranslations() instead."
        },
        {
          selector: ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > ConditionalExpression > Literal[value=/[a-zA-Z]/]",
          message: "ADV-071: Do not use hardcoded string literals inside JSX conditionals. Use useTranslations() instead."
        },
        {
          selector: ":matches(JSXElement, JSXFragment) > JSXExpressionContainer > LogicalExpression > Literal[value=/[a-zA-Z]/]",
          message: "ADV-071: Do not use hardcoded string literals inside JSX logical expressions. Use useTranslations() instead."
        },
        {
          // ADV-051: No Raw State Strings
          selector: "Literal[value=/^(active|inactive|archived|discontinued|draft|pending_putaway|awaiting_matching|quarantined|matched|unmatched|ambiguous)$/]:not(ImportDeclaration > Literal):not(TSLiteralType > Literal):not(CallExpression[callee.name=/^(describe|it|test|t|tCommon)$/] > Literal):not(JSXAttribute > Literal)",
          message: "ADV-051: Do not use raw string literals for state machine statuses. Import and use the appropriate constant from @herobm/shared."
        },
        {
          selector: "CallExpression[callee.name=/^t[A-Z]*/] ObjectExpression Property[key.name='fallback']",
          message: "ADV-072: Do not use 'fallback' in translation calls. Systematically add all strings to en.json."
        },
        {
          selector: "CallExpression[callee.name=/^t[A-Z]*/] ObjectExpression Property[key.name='defaultValue']",
          message: "ADV-072: Do not use 'defaultValue' in translation calls. Systematically add all strings to en.json."
        }
      ]
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', 'e2e/**'],
    rules: {
      'i18next/no-literal-string': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
