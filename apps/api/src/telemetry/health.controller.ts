import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { SkipCasbin } from '../auth/casbin.guard';

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
