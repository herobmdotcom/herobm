import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { EnvService } from '../common/config/env.service';

@Injectable()
export class PipelineSecretGuard implements CanActivate {
  private readonly logger = new Logger(PipelineSecretGuard.name);

  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedSecret = this.env.pipelineSecret;

    if (!expectedSecret) {
      this.logger.error(
        'FATAL: PIPELINE_SECRET environment variable is not configured on API',
      );
      throw new UnauthorizedException('Pipeline authentication unconfigured');
    }

    const headerSecret =
      request.headers['x-pipeline-secret'] ||
      (typeof request.headers['authorization'] === 'string' &&
      request.headers['authorization'].startsWith('Bearer ')
        ? request.headers['authorization'].slice(7).trim()
        : undefined);

    if (!headerSecret || headerSecret !== expectedSecret) {
      this.logger.warn(
        `Unauthorized webhook attempt from ${request.ip || 'unknown IP'}`,
      );
      throw new UnauthorizedException('Invalid or missing pipeline secret');
    }

    return true;
  }
}
