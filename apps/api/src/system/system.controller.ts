import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { SystemLogResponseDto, SystemVersionResponseDto } from './dto';
import { getErrorMessage, SystemResource } from '@herobm/shared';

let cachedApiVersion: string | null = null;

/**
 * Endpoint for streaming backend logs securely to the frontend Ops Portal.
 * Bypasses direct Docker socket exposure per Constitution (§ Inspector).
 */
@ApiTags('System')
@Controller('admin')
@CasbinResource(SystemResource.SYSTEM_LOGS)
export class SystemController {
  @Get('system-logs')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get System Logs',
    description:
      'Retrieves tail of raw system logs for administrative monitoring.',
  })
  @ApiOkResponse({ type: SystemLogResponseDto })
  @ApiQuery({ name: 'service', required: false })
  @ApiQuery({ name: 'lines', required: false })
  getSystemLogs(
    @Query('service') service?: string,
    @Query('lines') lines?: string,
  ) {
    const validServices = ['api', 'worker', 'postgres', 'integration'];
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
    } catch (e: unknown) {
      throw new BadRequestException(
        `Failed to read log file: ${getErrorMessage(e)}`,
      );
    }
  }

  @Get('version')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get System Version',
    description: 'Retrieves backend system environment and version data.',
  })
  @ApiOkResponse({ type: SystemVersionResponseDto })
  getSystemVersion(): SystemVersionResponseDto {
    if (!cachedApiVersion) {
      let gitVersion = process.env.APP_VERSION || '';
      if (!gitVersion) {
        const packageJsonPath = path.resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8'),
        );
        try {
          const fromGit = execSync(
            'git log -1 --format="%cd.%h" --date=format:%Y%m%d',
            { stdio: 'pipe' },
          )
            .toString()
            .trim();
          if (fromGit) {
            gitVersion = `v${packageJson.version}-${fromGit}`;
          }
        } catch (e) {
          // Ignore error
        }
        if (!gitVersion) {
          gitVersion = `v${packageJson.version}`;
        }
      }
      cachedApiVersion = gitVersion;
    }

    return {
      apiVersion: cachedApiVersion,
      apiBuildTime: process.env.BUILD_TIME || 'Unknown',
      nodeVersion: process.version,
      osPlatform: os.platform(),
      osRelease: os.release(),
    };
  }
}
