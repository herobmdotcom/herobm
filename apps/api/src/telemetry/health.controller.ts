import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SkipCasbin } from '../auth/casbin.guard';
import { Public } from '../auth/public.decorator';
import { RATE_LIMITS } from '../common/config/throttler.config';

export class HealthResponseDto {
  status!: string;
  uptime!: number;
  timestamp!: string;
}

@ApiTags('System')
@Controller()
@Public()
@SkipCasbin()
@UseGuards(ThrottlerGuard)
@Throttle({ default: RATE_LIMITS.HEALTH })
export class HealthController {
  @Get('health')
  @SkipCasbin()
  @HttpCode(200)
  @ApiOperation({
    summary: 'System Healthcheck',
    description:
      'Returns operational readiness for container orchestration health checks.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
