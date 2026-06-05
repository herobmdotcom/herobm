import { SystemResource } from '@modbm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Patch, Body, UseGuards, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AppConfigService } from './app-config.service';
import { AppConfigResponseDto, UpdateAppConfigDto } from './dto';

@Controller('settings/app')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOkResponse({ type: AppConfigResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'get', description: 'get operation' })
  async get() {
    const settings = this.appConfigService.getAppSettingsRaw();
    return settings || {};
  }

  @Patch()
  @ApiBody({ type: UpdateAppConfigDto })
  @ApiOkResponse({ type: AppConfigResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  async update(
    @Body()
    dto: UpdateAppConfigDto,
  ) {
    return this.appConfigService.update(dto);
  }
}
