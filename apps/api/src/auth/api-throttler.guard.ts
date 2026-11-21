import { appSettings } from '@herobm/db-schema';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  ThrottlerModuleOptions,
  ThrottlerRequest,
} from '@nestjs/throttler';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ApiThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const isApiKey = !!req.headers['x-api-key'];

    // If it's an API key request, bypass the 'default' throttler
    if (isApiKey && throttler.name === 'default') {
      return true;
    }

    // If it's a standard request, bypass the 'api' throttler
    if (!isApiKey && throttler.name === 'api') {
      return true;
    }

    if (isApiKey && throttler.name === 'api') {
      // Dynamic limit lookup
      const settings = await this.db
        .select({ limit: appSettings.apiRateLimit })
        .from(appSettings)
        .limit(1);
      if (settings.length > 0 && settings[0].limit) {
        requestProps.limit = Number(settings[0].limit);
        throttler.limit = Number(settings[0].limit);
        this.logger.debug(
          `[ThrottlerGuard] Override limit to ${throttler.limit} for IP ${req.ip} URL ${req.url}`,
        );
      }
    }

    return super.handleRequest(requestProps);
  }
}
