import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './providers/enrichment-provider.interface';
import { AbrProvider } from './providers/abr.provider';
import { TaxJarProvider } from './providers/taxjar.provider';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { integrations } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { EncryptionService } from '../common/encryption.service';
import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class EnrichmentService {
  private readonly providers: Map<string, IEnrichmentProvider> = new Map();

  constructor(
    private readonly abrProvider: AbrProvider,
    private readonly taxJarProvider: TaxJarProvider,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly encryptionService: EncryptionService,
    private readonly appConfig: AppConfigService,
    // Inject other providers here in the future
  ) {
    this.registerProvider(this.abrProvider);
    this.registerProvider(this.taxJarProvider);
  }

  private registerProvider(provider: IEnrichmentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProviders() {
    return Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      type: p.type,
      supportedCountries: p.supportedCountries,
      schema: p.getConfigSchema(),
    }));
  }

  // modbm-allow-record-any
  async getConfig(providerName: string): Promise<Record<string, any>> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(eq(integrations.provider, providerName))
      .limit(1);

    if (!integration) {
      return {};
    }

    return this.encryptionService.decryptConfig(
      // modbm-allow-record-any
      integration.config as Record<string, any>,
    );
  }

  // modbm-allow-record-any
  async updateConfig(providerName: string, config: Record<string, any>) {
    if (!this.providers.has(providerName)) {
      throw new NotFoundException(`Provider '${providerName}' not found`);
    }

    const encryptedConfig = this.encryptionService.encryptConfig(config);

    const [existing] = await this.db
      .select()
      .from(integrations)
      .where(eq(integrations.provider, providerName))
      .limit(1);

    if (existing) {
      await this.db
        .update(integrations)
        .set({ config: encryptedConfig })
        .where(eq(integrations.provider, providerName));
    } else {
      await this.db.insert(integrations).values({
        provider: providerName,
        config: encryptedConfig,
        isActive: true,
      });
    }

    return this.getConfig(providerName);
  }

  async lookupByField(
    field: string,
    country: string,
    // modbm-allow-record-any
    payload: string | Record<string, any>,
  ): Promise<EnrichmentResult> {
    const mappings = this.appConfig.enrichmentProviderMappings() || {};
    const providerName = mappings[field]?.[country];

    if (!providerName) {
      return { isValid: false, data: {} };
    }

    return this.lookup(providerName, payload);
  }

  async lookup(
    providerName: string,
    // modbm-allow-record-any
    payload: string | Record<string, any>,
  ): Promise<EnrichmentResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new NotFoundException(
        `Enrichment provider '${providerName}' not found`,
      );
    }

    const config = await this.getConfig(providerName);
    return provider.lookup(payload, config);
  }

  async recordTransaction(
    providerName: string,
    // modbm-allow-record-any
    payload: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new NotFoundException(
        `Enrichment provider '${providerName}' not found`,
      );
    }

    if (!provider.recordTransaction) {
      return { isValid: false, data: { error: 'Not supported' } };
    }

    const config = await this.getConfig(providerName);
    return provider.recordTransaction(payload, config);
  }

  async recordRefund(
    providerName: string,
    // modbm-allow-record-any
    payload: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new NotFoundException(
        `Enrichment provider '${providerName}' not found`,
      );
    }

    if (!provider.recordRefund) {
      return { isValid: false, data: { error: 'Not supported' } };
    }

    const config = await this.getConfig(providerName);
    return provider.recordRefund(payload, config);
  }
}
