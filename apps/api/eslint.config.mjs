// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs', '*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'off',
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      // ADV-047: DTO Validation Decorators
      // (Replacing external plugin with a native AST selector ensuring properties have decorators)
      // AST Custom Structural Rules (replacing .ps1 scripts)
      'no-restricted-syntax': [
        'error',
        {
          // ADV-047: Ensure DTO properties have validation decorators (requires them to have at least one decorator)
          selector: "ClassDeclaration[id.name=/.*Dto$/][id.name!=/.*ResponseDto$/][id.name!='EmptyBodyDto'][id.name!=/^Global.*Dto$/][id.name!=/^Paginated.*Dto$/] > ClassBody > PropertyDefinition:not(:has(Decorator))",
          message: "ADV-047: All Request DTO properties must have at least one @class-validator decorator (e.g., @IsString, @IsOptional) so the global ValidationPipe whitelist doesn't strip them."
        },
        {
          // ADV-047 (Addendum): Ensure DTO classes are exported
          selector: "ClassDeclaration[id.name=/.*Dto/][parent.type!='ExportNamedDeclaration'][parent.type!='ExportDefaultDeclaration']",
          message: "ADV-047: DTO classes must be exported. If they are not exported, NestJS ValidationPipe cannot access their type metadata and will strip all properties."
        },
        {
          // ADV-039: User Identity Consistency
          selector: "MemberExpression[object.name='user'][property.name='sub']",
          message: "ADV-039: Use 'req.user.username' instead of 'user.sub' for consistent human-readable audit trails."
        },
        {
          // ADV-038/082/083: Casbin Metadata Enforcement (Class level)
          // Every @Controller must have @CasbinResource(...) or be marked with @SkipCasbin().
          selector: "ClassDeclaration:has(Decorator > CallExpression > Identifier[name='Controller']):not(:has(Decorator > CallExpression > Identifier[name='CasbinResource'])):not(:has(Decorator > CallExpression > Identifier[name='SkipCasbin']))",
          message: "ADV-038: Every @Controller must have @CasbinResource(...) or be marked with @SkipCasbin()."
        },
        {
          // ADV-038: Casbin Decorators (Class level - legacy/guard check)
          selector: "ClassDeclaration:has(Decorator > CallExpression > Identifier[name='CasbinGuard']):not(:has(Decorator > CallExpression > Identifier[name='CasbinResource']))",
          message: "ADV-038: Controller uses CasbinGuard but is missing the @CasbinResource class decorator."
        },
        {
          // ADV-038: Casbin Decorators (Method level)
          selector: "MethodDefinition:has(Decorator > CallExpression > Identifier[name=/^(Get|Post|Put|Patch|Delete)$/]):not(:has(Decorator > CallExpression > Identifier[name=/^(CasbinAction|SkipCasbin)$/]))",
          message: "ADV-038: Every controller handler must have @CasbinAction or @SkipCasbin() to ensure deny-by-default behavior."
        },
        {
          // ADV-031/042: No Untyped Body
          selector: "Decorator[expression.callee.name='Body'] ~ TSTypeAnnotation[typeAnnotation.type='TSAnyKeyword']",
          message: "ADV-031/042: @Body() parameters must be strongly typed with a DTO class, not 'any'."
        },
        {
          // ADV-034: Hardcoded Currency Array in SQL Templates
          selector: "TaggedTemplateExpression[tag.callee.name='sql'] > TemplateLiteral > TemplateElement[value.raw=/'(EUR|USD|GBP|AUD|CAD)'/]",
          message: "ADV-034: Hardcoded currency value detected in SQL literal. Read from accounts.currencyCode instead."
        },
        {
          // ADV-045: Drizzle Typed Injection (no any)
          selector: "PropertyDefinition[key.name='db'] > TSTypeAnnotation[typeAnnotation.type='TSAnyKeyword']",
          message: "ADV-045: Inject Drizzle as DrizzleDB type, not any."
        },
        {
          // ADV-045: Drizzle Typed Injection (no getter over engineered)
          selector: "MethodDefinition[kind='get'][key.name='database']",
          message: "ADV-045: Inject DrizzleDB directly. Do not use a redundant get database() accessor."
        },
        {
          // ADV-025: No weak fallback defaults for secrets in TypeScript
          selector: "LogicalExpression[left.object.name='env'][left.property.name=/JWT_SECRET|PASSWORD|TOKEN|SECRET|API_KEY/][operator='??']",
          message: "ADV-025: Secret environment variables must not have fallback defaults via ?? operator. Let them fail loudly if unset."
        },
        {
          // ADV-032: Unauthenticated endpoints must be rate-limited
          selector: "ClassDeclaration:has(Decorator > CallExpression > Identifier[name='SkipCasbin']):not(:has(Decorator > CallExpression[callee.name='UseGuards'] > Identifier[name='ThrottlerGuard']))",
          message: "ADV-032: Controllers using @SkipCasbin() must also use @UseGuards(ThrottlerGuard) to prevent abuse on public endpoints."
        },
        {
          // ADV-033: No Wildcard CORS
          selector: "CallExpression[callee.property.name='enableCors'][arguments.length=0]",
          message: "ADV-033: enableCors() must not be called without an explicit configuration object. Wildcard CORS is forbidden."
        },
        {
          // ADV-024: No hardcoded secrets in source code
          selector: ":matches(Property[key.name=/password|secret|token|apiKey/i], VariableDeclarator[id.name=/password|secret|token|apiKey/i], AssignmentExpression[left.name=/password|secret|token|apiKey/i]) > Literal[value=/./]",
          message: "ADV-024: Do not hardcode credentials. Use process.env or mark as // TEST_CREDENTIAL if intentional."
        },
        {
          // ADV-050: State Machine Enforcement
          // Prevents raw mutations of stateCode outside of official change[Entity]State helpers.
          selector: "MethodDefinition[key.name!=/^change.*State$/] CallExpression[callee.property.name='set'] Property[key.name='stateCode']",
          message: "ADV-050: Raw stateCode mutations are forbidden. You must use or create a change[Entity]State() helper method to ensure state machine validation."
        },
        {
          // ADV-051: No Raw State Strings
          selector: "Literal[value=/^(active|inactive|archived|discontinued|draft|pending_putaway|awaiting_matching|quarantined|matched|unmatched|ambiguous)$/]:not(ImportDeclaration > Literal):not(TSLiteralType > Literal):not(CallExpression[callee.name=/^(describe|it|test|t|tCommon)$/] > Literal):not(JSXAttribute > Literal)",
          message: "ADV-051: Do not use raw string literals for state machine statuses. Import and use the appropriate constant from @modbm/shared."
        }
      ]
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
