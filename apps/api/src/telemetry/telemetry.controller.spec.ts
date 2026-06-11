import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { Logger, BadRequestException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [TelemetryController],
    }).compile();

    controller = module.get<TelemetryController>(TelemetryController);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should log a structured client error and return void (204)', () => {
    const dto = {
      message: 'Not authenticated',
      stack: 'Error: Not authenticated\n    at apiFetch',
      component: 'OrdersPage',
      url: 'http://localhost:4300/',
    };

    const result = controller.reportClientError(dto);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedPayload = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(loggedPayload).toEqual({
      event: 'client_error',
      message: 'Not authenticated',
      stack: dto.stack,
      component: 'OrdersPage',
      url: 'http://localhost:4300/',
    });
  });

  it('should handle minimal payload (message only)', () => {
    controller.reportClientError({ message: 'Something broke' });

    const loggedPayload = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(loggedPayload.event).toBe('client_error');
    expect(loggedPayload.message).toBe('Something broke');
    expect(loggedPayload.stack).toBeNull();
    expect(loggedPayload.component).toBeNull();
    expect(loggedPayload.url).toBeNull();
  });

  it('should throw BadRequestException when message is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => controller.reportClientError({} as any)).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when body is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => controller.reportClientError(null as any)).toThrow(
      BadRequestException,
    );
  });
});
