import { Injectable, Logger } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './enrichment-provider.interface';
import { getErrorMessage } from '@modbm/shared';

import { IntegrationLoggerService } from '../../common/integration-logger.service';

@Injectable()
export class TaxJarProvider implements IEnrichmentProvider {
  constructor(private readonly logger: IntegrationLoggerService) {
    this.logger.setContext(TaxJarProvider.name);
  }

  get name(): string {
    return 'taxjar';
  }

  get type(): 'enrichment' | 'tax_engine' {
    return 'tax_engine';
  }

  get supportedCountries(): string[] | 'global' {
    return 'global';
  }

  getConfigSchema(): Record<string, unknown> {
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
        testPayload: {
          type: 'string',
          title: 'Test Payload',
          default: JSON.stringify(
            {
              from_country: 'US',
              from_zip: '07001',
              from_state: 'NJ',
              to_country: 'US',
              to_zip: '07446',
              to_state: 'NJ',
              amount: 15,
              shipping: 1.5,
              line_items: [
                {
                  id: '1',
                  quantity: 1,
                  product_tax_code: '20010',
                  unit_price: 15,
                  discount: 0,
                },
              ],
            },
            null,
            2,
          ),
        },
      },
      required: ['apiKey'],
    };
  }

  async lookup(
    payload: string | Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<EnrichmentResult> {
    if (typeof payload === 'string') {
      return {
        isValid: false,
        data: { error: 'TaxJar requires a JSON payload' },
      };
    }

    const apiKey = (config?.apiKey as string) || process.env.TAXJAR_API_KEY;
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

    this.logger.log(
      `[TaxJar] Sending request to TaxJar (${baseUrl}/taxes) | Data: ${JSON.stringify(payload)}`,
    );

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
      this.logger.log(
        `[TaxJar] Received successful response from TaxJar | Data: ${JSON.stringify(data.tax)}`,
      );
      return {
        isValid: true,
        data: data.tax, // Return the tax object directly
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to reach TaxJar: ${getErrorMessage(error)}`);
      return {
        isValid: false,
        data: { error: 'Network error communicating with TaxJar' },
      };
    }
  }

  async recordTransaction(
    payload: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<EnrichmentResult> {
    const apiKey = config?.apiKey as string;
    if (!apiKey) return { isValid: false, data: { error: 'Missing API key' } };

    const isSandbox = config?.sandbox !== false;
    const baseUrl = isSandbox
      ? 'https://api.sandbox.taxjar.com/v2'
      : 'https://api.taxjar.com/v2';

    try {
      this.logger.log(
        `Recording transaction to TaxJar (${baseUrl}/transactions/orders): ${JSON.stringify(payload)}`,
      );
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
        this.logger.error(
          `TaxJar Transaction Error: ${response.status} ${errorBody}`,
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
      this.logger.log(
        `Transaction recorded successfully in TaxJar`,
        data.order,
      );
      return { isValid: true, data: data.order };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to record transaction: ${getErrorMessage(error)}`,
      );
      return { isValid: false, data: { error: 'Network error' } };
    }
  }

  async recordRefund(
    payload: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<EnrichmentResult> {
    const apiKey = config?.apiKey as string;
    if (!apiKey) return { isValid: false, data: { error: 'Missing API key' } };

    const isSandbox = config?.sandbox !== false;
    const baseUrl = isSandbox
      ? 'https://api.sandbox.taxjar.com/v2'
      : 'https://api.taxjar.com/v2';

    try {
      this.logger.log(
        `Recording refund to TaxJar (${baseUrl}/transactions/refunds): ${JSON.stringify(payload)}`,
      );
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
        this.logger.error(
          `TaxJar Refund Error: ${response.status} ${errorBody}`,
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
      this.logger.log(`Refund recorded successfully in TaxJar`, data.refund);
      return { isValid: true, data: data.refund };
    } catch (error: unknown) {
      this.logger.error(`Failed to record refund: ${getErrorMessage(error)}`);
      return { isValid: false, data: { error: 'Network error' } };
    }
  }
}
