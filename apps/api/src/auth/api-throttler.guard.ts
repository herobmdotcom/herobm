import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { appSettings } from '../drizzle/herobm-core-schema';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
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
      }
    }

    return super.handleRequest(requestProps);
  }
}
