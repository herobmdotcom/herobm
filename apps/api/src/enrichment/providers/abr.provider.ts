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

  // modbm-allow-record-any
  async lookup(
    // modbm-allow-record-any
    payload: string | Record<string, any>,
    // modbm-allow-record-any
    config?: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const cleanAbn =
      typeof payload === 'string'
        ? payload.replace(/\s+/g, '')
        : String((payload as any)?.abn || '').replace(/\s+/g, '');

    if (!config?.apiKey && !process.env.ABR_GUID) {
      throw new Error(
        'ABR API key not configured. Please configure it in Settings > Integrations.',
      );
    }

    // For now, this is a mock implementation.
    // In the future, this will call https://abr.business.gov.au/json/AbnDetails.aspx
    // using an API GUID configured in the environment.
    this.logger.log(`[ABR] Sending mock lookup request for ABN: ${cleanAbn}`);

    // Simulate an API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock validation logic
    if (cleanAbn === '51824753556') {
      const data = {
        name: 'AUSTRALIAN TAXATION OFFICE',
        isTaxRegistered: true,
      };
      this.logger.log(
        `[ABR] Received mock response for ABN: ${cleanAbn} | Data: ${JSON.stringify(data)}`,
      );
      return {
        isValid: true,
        data,
      };
    }

    if (cleanAbn === '11111111111') {
      const data = {
        name: 'UNREGISTERED HOBBYIST PTY LTD',
        isTaxRegistered: false,
      };
      this.logger.log(
        `[ABR] Received mock response for ABN: ${cleanAbn} | Data: ${JSON.stringify(data)}`,
      );
      return {
        isValid: true,
        data,
      };
    }

    // Default mock response for any 11-digit number
    if (cleanAbn.length === 11 && /^\d+$/.test(cleanAbn)) {
      const data = {
        name: 'MOCK COMPANY PTY LTD',
        isTaxRegistered: true,
      };
      this.logger.log(
        `[ABR] Received mock response for ABN: ${cleanAbn} | Data: ${JSON.stringify(data)}`,
      );
      return {
        isValid: true,
        data,
      };
    }

    // Invalid ABN
    this.logger.log(
      `[ABR] Received mock invalid response for ABN: ${cleanAbn}`,
    );
    return {
      isValid: false,
      data: {},
    };
  }
}
