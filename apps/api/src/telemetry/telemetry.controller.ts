import { Controller, Post, Body, HttpCode, Logger, BadRequestException } from '@nestjs/common';
import { SkipCasbin } from '../auth/casbin.guard';

class ClientErrorDto {
  message!: string;
  stack?: string;
  component?: string;
  url?: string;
}

/**
 * Telemetry ingestion endpoint for client-side errors.
 *
 * Frontend portals call this to ship errors that occur before an HTTP request
 * (e.g. missing auth token, JSON parse failures) into the PLG stack via
 * structured stdout logging → Promtail → Loki.
 *
 * @SkipCasbin() — telemetry must work even when the user's session has expired
 * or the auth token is missing (those are common error scenarios themselves).
 */
@Controller('telemetry')
@SkipCasbin()
export class TelemetryController {
  private readonly logger = new Logger('ClientTelemetry');

  @Post('client-errors')
  @HttpCode(204)
  reportClientError(@Body() dto: ClientErrorDto): void {
    if (!dto || !dto.message) {
      throw new BadRequestException('message is required');
    }

    this.logger.warn(
      JSON.stringify({
        event: 'client_error',
        message: dto.message,
        stack: dto.stack ?? null,
        component: dto.component ?? null,
        url: dto.url ?? null,
      }),
    );
  }
}
