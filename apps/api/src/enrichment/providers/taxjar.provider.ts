import { Injectable, Logger } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './enrichment-provider.interface';

import { IntegrationLoggerService } from '../../common/integration-logger.service';

@Injectable()
export class TaxJarProvider implements IEnrichmentProvider {
  constructor(private readonly logger: IntegrationLoggerService) {
    this.logger.setContext(TaxJarProvider.name);
  }

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

  async recordTransaction(
    payload: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const apiKey = config?.apiKey as string;
    if (!apiKey) return { isValid: false, data: { error: 'Missing API key' } };

    const isSandbox = config?.sandbox !== false;
    const baseUrl = isSandbox
      ? 'https://api.sandbox.taxjar.com/v2'
      : 'https://api.taxjar.com/v2';

    try {
      this.logger.log(`Recording transaction to TaxJar (${baseUrl}/transactions/orders)`, payload);
      const response = await fetch(`${baseUrl}/transactions/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`TaxJar Transaction Error: ${response.status} ${errorBody}`);
        return { isValid: false, data: { error: `TaxJar API Error (${response.status})`, details: errorBody } };
      }

      const data = await response.json();
      this.logger.log(`Transaction recorded successfully in TaxJar`, data.order);
      return { isValid: true, data: data.order };
    } catch (error: any) {
      this.logger.error(`Failed to record transaction: ${error.message}`);
      return { isValid: false, data: { error: 'Network error' } };
    }
  }

  async recordRefund(
    payload: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const apiKey = config?.apiKey as string;
    if (!apiKey) return { isValid: false, data: { error: 'Missing API key' } };

    const isSandbox = config?.sandbox !== false;
    const baseUrl = isSandbox
      ? 'https://api.sandbox.taxjar.com/v2'
      : 'https://api.taxjar.com/v2';

    try {
      this.logger.log(`Recording refund to TaxJar (${baseUrl}/transactions/refunds)`, payload);
      const response = await fetch(`${baseUrl}/transactions/refunds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`TaxJar Refund Error: ${response.status} ${errorBody}`);
        return { isValid: false, data: { error: `TaxJar API Error (${response.status})`, details: errorBody } };
      }

      const data = await response.json();
      this.logger.log(`Refund recorded successfully in TaxJar`, data.refund);
      return { isValid: true, data: data.refund };
    } catch (error: any) {
      this.logger.error(`Failed to record refund: ${error.message}`);
      return { isValid: false, data: { error: 'Network error' } };
    }
  }
}
