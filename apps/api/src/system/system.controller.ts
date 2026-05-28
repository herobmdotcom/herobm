import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import * as fs from 'fs';
import * as path from 'path';
import { SystemLogResponseDto } from './dto';

/**
 * Endpoint for streaming backend logs securely to the frontend Ops Portal.
 * Bypasses direct Docker socket exposure per Constitution (§ Inspector).
 */
@ApiTags('System')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('system_logs')
export class SystemController {
  @Get('system-logs')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get System Logs',
    description:
      'Retrieves tail of raw system logs for administrative monitoring.',
  })
  @ApiOkResponse({ type: SystemLogResponseDto })
  getSystemLogs(
    @Query('service') service?: string,
    @Query('lines') lines?: string,
  ) {
    const validServices = ['api', 'worker', 'postgres'];
    const resolvedService = service || 'api';
    const targetService = validServices.includes(resolvedService)
      ? resolvedService
      : 'api';
    const numLines = lines ? parseInt(lines, 10) : 1000;

    if (isNaN(numLines) || numLines < 1 || numLines > 5000) {
      throw new BadRequestException('lines must be between 1 and 5000');
    }

    const logDir =
      process.env.PIPELINE_LOG_DIR || path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, `${targetService}.log`);

    if (!fs.existsSync(logFile)) {
      return { lines: [] };
    }

    try {
      // For this debug-only endpoint, synchronously reading the file tail is acceptable.
      const content = fs.readFileSync(logFile, 'utf8');
      const allLines = content.split('\n').filter((l) => l.trim().length > 0);
      const start = Math.max(0, allLines.length - numLines);

      return { lines: allLines.slice(start) };
    } catch (e: any) {
      throw new BadRequestException(`Failed to read log file: ${e.message}`);
    }
  }
}
