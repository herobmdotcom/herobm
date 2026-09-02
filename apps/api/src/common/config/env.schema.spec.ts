/* eslint-disable no-restricted-syntax -- Unit tests validating schema validation against mock test secrets */
import { envSchema, validateEnv } from './env.schema';
import { EnvService } from './env.service';
import { ConfigService } from '@nestjs/config';

describe('Environment Validation', () => {
  it('should parse default development configuration correctly', () => {
    const config = validateEnv({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.DEPLOYMENT_TIER).toBe('development');
    expect(config.PORT).toBe(3001);
    expect(config.POSTGRES_HOST).toBe('localhost');
    expect(config.POSTGRES_PORT).toBe(5432);
    expect(config.POSTGRES_DB).toBe('herobm');
    expect(config.ENABLE_SWAGGER).toBe('false');
  });

  it('should coerce numeric string variables correctly', () => {
    const config = validateEnv({
      PORT: '8080',
      POSTGRES_PORT: '5433',
    });
    expect(config.PORT).toBe(8080);
    expect(config.POSTGRES_PORT).toBe(5433);
  });

  it('should fail validation with invalid NODE_ENV', () => {
    expect(() => {
      validateEnv({
        NODE_ENV: 'invalid_env',
      });
    }).toThrow(/NODE_ENV/);
  });

  it('should fail validation with invalid PORT', () => {
    expect(() => {
      validateEnv({
        PORT: 'not-a-number',
      });
    }).toThrow(/PORT/);
  });

  it('should reject default or weak JWT_SECRET in production tier', () => {
    expect(() => {
      validateEnv({
        DEPLOYMENT_TIER: 'production',
        NODE_ENV: 'production',
        // Omitting or using default JWT_SECRET
      });
    }).toThrow(/JWT_SECRET/);

    expect(() => {
      validateEnv({
        DEPLOYMENT_TIER: 'production',
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short', // TEST_CREDENTIAL
      });
    }).toThrow(/JWT_SECRET/);
  });

  it('should succeed with valid strong JWT_SECRET in production tier', () => {
    const strongSecret = 'super_secure_production_secret_key_1234567890'; // TEST_CREDENTIAL
    const config = validateEnv({
      DEPLOYMENT_TIER: 'production',
      NODE_ENV: 'production',
      JWT_SECRET: strongSecret,
    });
    expect(config.DEPLOYMENT_TIER).toBe('production');
    expect(config.NODE_ENV).toBe('production');
    expect(config.JWT_SECRET).toBe(strongSecret);
  });

  describe('EnvService', () => {
    it('should have strongly typed methods that function correctly', () => {
      const parsed = envSchema.parse({
        PORT: '4000',
        NODE_ENV: 'production',
        DEPLOYMENT_TIER: 'production',
        JWT_SECRET: 'super_secret_production_key_123456789', // TEST_CREDENTIAL
        CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
        ENABLE_SWAGGER: 'false',
        DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/herobm',
        STORAGE_PATH: 'uploads/data',
        PIPELINE_SECRET: 'secret-token-123', // TEST_CREDENTIAL
        TYPST_BINARY_PATH: '/usr/local/bin/typst',
      });

      const mockConfigService = new ConfigService(parsed);
      const envService = new EnvService(mockConfigService as any);

      expect(envService.port).toBe(4000);
      expect(envService.isProduction).toBe(true);
      expect(envService.isTest).toBe(false);
      expect(envService.deploymentTier).toBe('production');
      expect(envService.jwtSecret).toBe(
        'super_secret_production_key_123456789',
      );
      expect(envService.corsOrigins).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
      expect(envService.enableSwagger).toBe(false);
      expect(envService.databaseUrl).toBe(
        'postgresql://postgres:pass@localhost:5432/herobm',
      );
      expect(envService.storagePath).toBe('uploads/data');
      expect(envService.pipelineSecret).toBe('secret-token-123');
      expect(envService.typstBinaryPath).toBe('/usr/local/bin/typst');
    });
  });
});
