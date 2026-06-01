import { Injectable } from '@nestjs/common';
import {
  IEnrichmentProvider,
  EnrichmentResult,
} from './enrichment-provider.interface';

@Injectable()
export class AbrProvider implements IEnrichmentProvider {
  get name(): string {
    return 'abr';
  }

  getConfigSchema(): any {
    return {
      type: 'object',
      properties: {
        apiKey: { type: 'string', title: 'ABR API GUID', format: 'password' },
      },
      required: ['apiKey'],
    };
  }

  async lookup(
    payload: string | Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult> {
    const query = typeof payload === 'string' ? payload : '';
    // Basic cleanup of the ABN string (remove spaces)
    const cleanAbn = query.replace(/\s/g, '');

    if (!config?.apiKey) {
      throw new Error('ABR API key not configured. Please configure it in Settings > Integrations.');
    }


    // For now, this is a mock implementation.
    // In the future, this will call https://abr.business.gov.au/json/AbnDetails.aspx
    // using an API GUID configured in the environment.

    // Simulate an API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock validation logic
    if (cleanAbn === '51824753556') {
      return {
        isValid: true,
        data: {
          name: 'AUSTRALIAN TAXATION OFFICE',
          isTaxRegistered: true,
        },
      };
    }

    if (cleanAbn === '11111111111') {
      return {
        isValid: true,
        data: {
          name: 'UNREGISTERED HOBBYIST PTY LTD',
          isTaxRegistered: false,
        },
      };
    }

    // Default mock response for any 11-digit number
    if (cleanAbn.length === 11 && /^\\d+$/.test(cleanAbn)) {
      return {
        isValid: true,
        data: {
          name: 'MOCK COMPANY PTY LTD',
          isTaxRegistered: true,
        },
      };
    }

    // Invalid ABN
    return {
      isValid: false,
      data: {},
    };
  }
}
