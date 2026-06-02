import { Injectable, Logger } from '@nestjs/common';

export interface ReportContextResolver {
  resolveData(
    id: string,
    user: any,
    options?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getRandomId?(): Promise<string | undefined>;
}

@Injectable()
export class ReportsRegistry {
  private readonly logger = new Logger(ReportsRegistry.name);
  private readonly resolvers = new Map<string, ReportContextResolver>();

  register(context: string, resolver: ReportContextResolver) {
    if (this.resolvers.has(context)) {
      this.logger.warn(
        `Resolver for context "${context}" is being overwritten.`,
      );
    }
    this.resolvers.set(context, resolver);
    this.logger.log(`Registered report resolver for context: ${context}`);
  }

  getResolver(context: string): ReportContextResolver | undefined {
    return this.resolvers.get(context);
  }

  getRegisteredContexts(): string[] {
    return Array.from(this.resolvers.keys());
  }
}
