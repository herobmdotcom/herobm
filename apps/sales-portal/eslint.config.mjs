import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// For Next.js to provide its core functionality, we'd normally want eslint-config-next. 
// Due to pure ESM / Flat Config migration complexity with Next 15, we'll keep our structural checks minimal and native.

export default tseslint.config(
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'eslint.config.mjs'],
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
      // Existing typical frontend waivers
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
        }
      ]
    },
  },
);
