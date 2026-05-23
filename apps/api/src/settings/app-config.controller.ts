import { Controller, Patch, Body, UseGuards, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AppConfigService } from './app-config.service';

@Controller('settings/app')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @CasbinAction('read')
  async get() {
    return this.appConfigService.getAppSettingsRaw();
  }

  @Patch()
  @CasbinAction('write')
  async update(@Body() dto: { defaultFulfillmentLocationId?: string }) {
    return this.appConfigService.update(dto);
  }
}
