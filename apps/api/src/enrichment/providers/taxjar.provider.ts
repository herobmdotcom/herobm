import { Injectable, Logger } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './enrichment-provider.interface';

@Injectable()
export class TaxJarProvider implements IEnrichmentProvider {
  private readonly logger = new Logger(TaxJarProvider.name);

  get name(): string {
    return 'taxjar';
  }

  getConfigSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          title: 'TaxJar API Key',
          description: 'Your TaxJar API token',
        },
        sandbox: {
          type: 'boolean',
          title: 'Use Sandbox Environment',
          default: true,
        },
      },
      required: ['apiKey'],
    };
  }

  async lookup(
    payload: string | Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult> {
    if (typeof payload === 'string') {
      return {
        isValid: false,
        data: { error: 'TaxJar requires a JSON payload' },
      };
    }

    const apiKey = config?.apiKey || process.env.TAXJAR_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'TaxJar API key is missing from config and environment',
      );
      return {
        isValid: false,
        data: { error: 'TaxJar API key not configured' },
      };
    }

    const isSandbox =
      config?.sandbox !== false && process.env.TAXJAR_ENV !== 'production';
    const baseUrl = isSandbox
      ? 'https://api.sandbox.taxjar.com/v2'
      : 'https://api.taxjar.com/v2';

    try {
      const response = await fetch(`${baseUrl}/taxes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `TaxJar API Error: ${response.status} - ${errorBody}`,
        );
        return {
          isValid: false,
          data: {
            error: `TaxJar API Error (${response.status})`,
            details: errorBody,
          },
        };
      }

      const data = await response.json();
      return {
        isValid: true,
        data: data.tax, // Return the tax object directly
      };
    } catch (error: any) {
      this.logger.error(`Failed to reach TaxJar: ${error.message}`);
      return {
        isValid: false,
        data: { error: 'Network error communicating with TaxJar' },
      };
    }
  }
}
