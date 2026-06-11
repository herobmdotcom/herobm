import { Injectable, Logger } from '@nestjs/common';

export interface DataSourceProvider {
  // Used by Business Reports (Ag-Grid / Recharts)
  fetchData?(
    filters: Record<string, unknown>,
    user?: { role?: string },
  ): Promise<Record<string, unknown>[]>;

  // Used by PDF Templates (Typst)
  resolveData?(
    id: string,
    user: { role?: string },
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getRandomId?(): Promise<string | undefined>;

  // Fallback: Called if DB is empty to provide structure
  generateMockData?(): Record<string, unknown> | Record<string, unknown>[];

  requiredPermissions?: { resource: string; action: string }[];
}

@Injectable()
export class DataSourcesRegistry {
  private readonly logger = new Logger(DataSourcesRegistry.name);
  private readonly providers = new Map<string, DataSourceProvider>();

  register(slug: string, provider: DataSourceProvider) {
    if (this.providers.has(slug)) {
      this.logger.warn(
        `Data source provider for "${slug}" is being overwritten.`,
      );
    }
    this.providers.set(slug, provider);
    this.logger.log(`Registered data source provider: ${slug}`);
  }

  getProvider(slug: string): DataSourceProvider | undefined {
    return this.providers.get(slug);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProvidersWithFetchData(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => !!provider.fetchData)
      .map(([slug]) => slug);
  }

  getProvidersWithResolveData(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => !!provider.resolveData)
      .map(([slug]) => slug);
  }
}
