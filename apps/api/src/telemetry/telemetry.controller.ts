import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SkipCasbin } from '../auth/casbin.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

// Maximum field lengths (truncated silently to prevent log injection / disk exhaustion)
const MAX_MESSAGE_LEN = 500;
const MAX_STACK_LEN = 2000;
const MAX_URL_LEN = 500;
const MAX_COMPONENT_LEN = 100;

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ClientErrorDto } from './dto';

/**
 * Telemetry ingestion endpoint for client-side errors.
 *
 * Frontend portals call this to ship errors that occur before an HTTP request
 * (e.g. missing auth token, JSON parse failures) into the PLG stack via
 * structured stdout logging → Promtail → Loki.
 *
 * Security posture:
 * - @SkipCasbin() — telemetry must work even when the user's session has expired
 *   or the auth token is missing (those are common error scenarios themselves).
 * - @Throttle() — rate-limited to 10 requests per 60 seconds per IP to prevent abuse.
 * - Field lengths are truncated to prevent log injection and disk exhaustion.
 *
 * See ADV-032 for the security analysis of this endpoint.
 */
@Controller('telemetry')
@SkipCasbin()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class TelemetryController {
  private readonly logger = new Logger('ClientTelemetry');

  @Post('client-errors')
  @SkipCasbin()
  @HttpCode(204)
  reportClientError(@Body() dto: ClientErrorDto): void {
    if (!dto || !dto.message) {
      throw new BadRequestException('message is required');
    }

    this.logger.warn(
      JSON.stringify({
        event: 'client_error',
        message: dto.message.slice(0, MAX_MESSAGE_LEN),
        stack: (dto.stack ?? '').slice(0, MAX_STACK_LEN) || null,
        component: (dto.component ?? '').slice(0, MAX_COMPONENT_LEN) || null,
        url: (dto.url ?? '').slice(0, MAX_URL_LEN) || null,
      }),
    );
  }
}
