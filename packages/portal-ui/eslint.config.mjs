import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', '**/lib/api.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      
      // ADV-029: PLG Stack Reporting - Ban direct console.error
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
          message: "ADV-029: Use reportError() instead of console.error() to ensure observability in the PLG stack."
        },
        // ADV-034: No Hardcoded Currency near amounts
        {
          selector: "Literal[value=/€/], TemplateElement[value.raw=/€/]",
          message: "Do not hardcode currency symbols. Use the formatted amount from the backend or the shared currency formatter."
        },
        // ADV-041: Enforce API Client Usage
        {
          selector: "CallExpression[callee.name='fetch']",
          message: "ADV-041: Do not use raw fetch(). Use apiFetch(), apiMutate(), or apiFetchBlob() from @/lib/api to ensure consistent authentication and error handling."
        }
      ]
    },
  },
);
