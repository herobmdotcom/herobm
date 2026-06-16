import { Injectable } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './enrichment-provider.interface';
import { IntegrationLoggerService } from '../../common/integration-logger.service';

@Injectable()
export class AbrProvider implements IEnrichmentProvider {
  constructor(private readonly logger: IntegrationLoggerService) {
    this.logger.setContext(AbrProvider.name);
  }

  get name(): string {
    return 'abr';
  }

  get type(): 'enrichment' | 'tax_engine' {
    return 'enrichment';
  }

  get supportedCountries(): string[] | 'global' {
    return ['AU'];
  }

  getConfigSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        apiKey: { type: 'string', title: 'ABR API GUID', format: 'password' },
        testPayload: {
          type: 'object',
          title: 'Test Payload',
          description: 'A sample payload to test the integration.',
          default: JSON.stringify(
            {
              abn: '51824753556',
            },
            null,
            2,
          ),
        },
      },
    };
  }

  async lookup(
    payload: string | Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<EnrichmentResult> {
    const cleanAbn =
      typeof payload === 'string'
        ? payload.replace(/\s+/g, '')
        : String((payload as Record<string, string>)?.abn || '').replace(
            /\s+/g,
            '',
          );

    if (!config?.apiKey) {
      throw new Error(
        'ABR API key not configured. Please configure it in Settings > Integrations.',
      );
    }

    this.logger.log(`[ABR] Sending lookup request for ABN: ${cleanAbn}`);

    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanAbn}&guid=${config.apiKey as string}&callback=callback`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(
          `[ABR] HTTP Error: ${response.status} ${response.statusText}`,
        );
        return { isValid: false, data: {} };
      }

      const text = await response.text();

      // Strip the JSONP callback wrapper: "callback({...})"
      const jsonString = text.replace(/^callback\(/, '').replace(/\)$/, '');

      const data = JSON.parse(jsonString);

      if (data.Message) {
        this.logger.error(`[ABR] API Error Message: ${data.Message}`);
        return { isValid: false, data: {} };
      }

      const name =
        data.EntityName ||
        (data.BusinessName && data.BusinessName[0]) ||
        'Unknown';
      const isTaxRegistered = !!data.Gst;

      this.logger.log(`[ABR] Successfully retrieved data for ABN: ${cleanAbn}`);

      return {
        isValid: true,
        data: {
          name,
          isTaxRegistered,
        },
      };
    } catch (error) {
      this.logger.error(
        `[ABR] Exception during lookup: ${(error as Error).message}`,
      );
      return { isValid: false, data: {} };
    }
  }
}
