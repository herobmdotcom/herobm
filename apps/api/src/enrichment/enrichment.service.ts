import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './providers/enrichment-provider.interface';
import { AbrProvider } from './providers/abr.provider';
import { TaxJarProvider } from './providers/taxjar.provider';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { integrations } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { EncryptionService } from '../common/encryption.service';
import { AppConfigService } from '../settings/app-config.service';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

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

  async getConfig(
    providerName: string,
    tx?: DrizzleDB,
    // Configuration schemas vary by provider and are stored generically in the database.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  ): Promise<Record<string, any>> {
    const db = tx || this.db;
    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.provider, providerName))
      .limit(1);

    if (!integration) {
      return {};
    }

    return this.encryptionService.decryptConfig(
      // Type casting to Record<string, any> is required since db column is jsonb.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      integration.config as Record<string, any>,
    );
  }

  // Config payload is generic since the schema depends on the chosen provider.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  async updateConfig(providerName: string, config: Record<string, any>) {
    if (!this.providers.has(providerName)) {
      throw new NotFoundException(`Provider '${providerName}' not found`);
    }

    const encryptedConfig = this.encryptionService.encryptConfig(config);

    await this.db.transaction(async (tx) => {
      let intgId: string;
      const [existing] = await tx
        .select()
        .from(integrations)
        .where(eq(integrations.provider, providerName))
        .limit(1);

      if (existing) {
        intgId = existing.integrationId;
        await tx
          .update(integrations)
          .set({ config: encryptedConfig })
          .where(eq(integrations.provider, providerName));
      } else {
        const [inserted] = await tx
          .insert(integrations)
          .values({
            provider: providerName,
            config: encryptedConfig,
            isActive: true,
          })
          .returning({ integrationId: integrations.integrationId });
        intgId = inserted.integrationId;
      }

      await emitEvent(tx, {
        entityType: EntityType.INTEGRATION,
        entityId: intgId,
        eventType: EventType.UPDATED,
        entityDisplayName: providerName,
        payload: { providerName },
      });
    });

    return this.getConfig(providerName);
  }

  async lookupByField(
    field: string,
    country: string,
    // The payload structure is dynamic depending on the mapped enrichment provider.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
    // The payload structure is dynamic depending on the requested enrichment provider.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
    // Dynamic payload to accommodate various external provider schemas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    payload: Record<string, any>,
    tx?: DrizzleDB,
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

    const config = await this.getConfig(providerName, tx);
    return provider.recordTransaction(payload, config);
  }

  async recordRefund(
    providerName: string,
    // Dynamic payload to accommodate various external provider schemas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    payload: Record<string, any>,
    tx?: DrizzleDB,
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

    const config = await this.getConfig(providerName, tx);
    return provider.recordRefund(payload, config);
  }
}
