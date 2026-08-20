import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './env.schema';

@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config.get(key, { infer: true });
  }

  get port(): number {
    return this.get('PORT');
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }

  get deploymentTier(): string {
    return this.get('DEPLOYMENT_TIER');
  }

  get jwtSecret(): string {
    return this.get('JWT_SECRET');
  }

  get databaseUrl(): string | undefined {
    return this.get('DATABASE_URL');
  }

  get postgresHost(): string {
    return this.get('POSTGRES_HOST');
  }

  get postgresPort(): number {
    return this.get('POSTGRES_PORT');
  }

  get postgresUser(): string | undefined {
    return this.get('POSTGRES_USER');
  }

  get postgresPassword(): string | undefined {
    return this.get('POSTGRES_PASSWORD');
  }

  get postgresDb(): string {
    return this.get('POSTGRES_DB');
  }

  get corsOrigins(): string[] {
    const raw = this.get('CORS_ORIGINS');
    return raw ? raw.split(',').map((o) => o.trim()) : [];
  }

  get enableSwagger(): boolean {
    return this.get('ENABLE_SWAGGER') !== 'false';
  }

  get storagePath(): string | undefined {
    return this.get('STORAGE_PATH');
  }

  get pipelineSecret(): string | undefined {
    return this.get('PIPELINE_SECRET');
  }

  get typstBinaryPath(): string {
    return this.get('TYPST_BINARY_PATH') || 'typst';
  }
}
