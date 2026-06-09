/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AbrProvider } from './abr.provider';
import { IntegrationLoggerService } from '../../common/integration-logger.service';

describe('AbrProvider', () => {
  let provider: AbrProvider;
  let loggerService: IntegrationLoggerService;
  let globalFetchMock: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbrProvider,
        {
          provide: IntegrationLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<AbrProvider>(AbrProvider);
    loggerService = module.get<IntegrationLoggerService>(
      IntegrationLoggerService,
    );

    // Mock global fetch
    globalFetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('lookup', () => {
    // eslint-disable-next-line no-restricted-syntax
    const mockConfig = { apiKey: 'test-guid' }; // TEST_CREDENTIAL

    it('should throw error if API key is missing', async () => {
      await expect(provider.lookup('51824753556', {})).rejects.toThrow(
        'ABR API key not configured. Please configure it in Settings > Integrations.',
      );
    });

    it('should correctly parse valid ABN response (JSONP stripping)', async () => {
      // Mock ABR valid response for ATO
      const mockResponseBody = `callback({
        "Abn": "51824753556",
        "EntityName": "AUSTRALIAN TAXATION OFFICE",
        "Gst": "2000-07-01",
        "Message": ""
      })`;

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockResponseBody),
      });

      const result = await provider.lookup('51824753556', mockConfig);

      expect(globalFetchMock).toHaveBeenCalledWith(
        'https://abr.business.gov.au/json/AbnDetails.aspx?abn=51824753556&guid=test-guid&callback=callback',
      );
      expect(result).toEqual({
        isValid: true,
        data: {
          name: 'AUSTRALIAN TAXATION OFFICE',
          isTaxRegistered: true,
        },
      });
      expect(loggerService.log).toHaveBeenCalledWith(
        '[ABR] Successfully retrieved data for ABN: 51824753556',
      );
    });

    it('should correctly parse unregistered ABN response', async () => {
      const mockResponseBody = `callback({
        "Abn": "11111111111",
        "EntityName": "UNREGISTERED HOBBYIST PTY LTD",
        "Gst": "",
        "Message": ""
      })`;

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockResponseBody),
      });

      const result = await provider.lookup('11111111111', mockConfig);

      expect(result).toEqual({
        isValid: true,
        data: {
          name: 'UNREGISTERED HOBBYIST PTY LTD',
          isTaxRegistered: false,
        },
      });
    });

    it('should use BusinessName if EntityName is empty', async () => {
      const mockResponseBody = `callback({
        "Abn": "11111111111",
        "EntityName": "",
        "BusinessName": ["SOME TRADING NAME"],
        "Gst": "",
        "Message": ""
      })`;

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockResponseBody),
      });

      const result = await provider.lookup('11111111111', mockConfig);

      expect(result).toEqual({
        isValid: true,
        data: {
          name: 'SOME TRADING NAME',
          isTaxRegistered: false,
        },
      });
    });

    it('should handle API error messages (invalid ABN)', async () => {
      const mockResponseBody = `callback({
        "Message": "Search text is not a valid ABN or ACN"
      })`;

      globalFetchMock.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockResponseBody),
      });

      const result = await provider.lookup('INVALID_ABN', mockConfig);

      expect(result).toEqual({
        isValid: false,
        data: {},
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        '[ABR] API Error Message: Search text is not a valid ABN or ACN',
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      globalFetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await provider.lookup('51824753556', mockConfig);

      expect(result).toEqual({
        isValid: false,
        data: {},
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        '[ABR] HTTP Error: 500 Internal Server Error',
      );
    });

    it('should handle network exceptions gracefully', async () => {
      globalFetchMock.mockRejectedValueOnce(new Error('Network offline'));

      const result = await provider.lookup('51824753556', mockConfig);

      expect(result).toEqual({
        isValid: false,
        data: {},
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        '[ABR] Exception during lookup: Network offline',
      );
    });
  });
});
