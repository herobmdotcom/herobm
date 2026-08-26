import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    DEPLOYMENT_TIER: z
      .enum(['development', 'staging', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    API_PORT: z.coerce.number().int().positive().optional(),
    HOST: z.string().default('0.0.0.0'),

    // Database connection parameters
    DATABASE_URL: z.string().optional(),
    POSTGRES_HOST: z.string().default('localhost'),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_PASSWORD: z.string().optional(),
    POSTGRES_DB: z.string().default('herobm'),
    USE_PGLITE: z.string().optional(),

    // Security & Auth
    JWT_SECRET: z
      .string()
      .default('development_jwt_secret_must_be_overridden_in_prod'),
    ENCRYPTION_KEY: z.string().optional(),
    PIPELINE_SECRET: z.string().optional(),
    PIPELINE_RUNNER_URL: z.string().optional(),
    CORS_ORIGINS: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    DEV_ADMIN_PASSWORD: z.string().optional(),
    ENV_FILE: z.string().optional(),

    // Feature Flags & System Tools
    ENABLE_SWAGGER: z.string().default('true'),
    STORAGE_PATH: z.string().optional(),
    PIPELINE_LOG_DIR: z.string().optional(),
    TYPST_BINARY_PATH: z.string().optional(),

    // External Services (Taxjar, etc.)
    TAXJAR_API_KEY: z.string().optional(),
    TAXJAR_ENV: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // In production tier, enforce non-default and adequately sized JWT secret
    if (
      data.DEPLOYMENT_TIER === 'production' ||
      data.NODE_ENV === 'production'
    ) {
      if (
        !data.JWT_SECRET ||
        data.JWT_SECRET ===
          'development_jwt_secret_must_be_overridden_in_prod' ||
        data.JWT_SECRET.length < 16
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'JWT_SECRET must be explicitly set and at least 16 characters in production environments.',
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(rawConfig: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(rawConfig);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((err) => `  - [${err.path.join('.')}]: ${err.message}`)
      .join('\n');
    const msg = `FATAL: Environment configuration validation failed:\n${errorDetails}`;
    // eslint-disable-next-line no-restricted-syntax -- System bootstrap failure
    console.error(`\x1b[31m${msg}\x1b[0m`);
    throw new Error(msg);
  }
  return result.data;
}
