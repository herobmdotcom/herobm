import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/sales-orders',
    };
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('should log HttpException (404) as structured JSON via warn', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(payload.event).toBe('unhandled_exception');
    expect(payload.method).toBe('GET');
    expect(payload.path).toBe('/api/sales-orders');
    expect(payload.statusCode).toBe(404);
    expect(payload.message).toBe('Not Found');

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Not Found',
        path: '/api/sales-orders',
      }),
    );
  });

  it('should log unknown Error as 500 via error logger', () => {
    const exception = new Error('Database connection lost');

    filter.catch(exception, mockHost);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(payload.event).toBe('unhandled_exception');
    expect(payload.statusCode).toBe(500);
    expect(payload.message).toBe('Database connection lost');
    expect(payload.stack).toBeDefined();

    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should handle non-Error throws (string) as 500', () => {
    filter.catch('Something unexpected', mockHost);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(payload.statusCode).toBe(500);
    expect(payload.message).toBe('Something unexpected');
    expect(payload.stack).toBeNull();

    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should log HttpException (403) as warn, not error', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });

  describe('Postgres Error Mapping', () => {
    it('should map Postgres code 23505 to 409 Conflict', () => {
      const error = { code: '23505', detail: 'Key already exists' };
      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          message: expect.stringContaining('DB Detail: Key already exists'),
        }),
      );
    });

    it('should map Postgres code 23503 to 422 Unprocessable Entity', () => {
      const error = { code: '23503', detail: 'Foreign key violation' };
      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should map Postgres code 23514 to 400 Bad Request', () => {
      const error = { code: '23514', detail: 'Check constraint violation' };
      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });
  });
});
