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
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { AppConfigService } from './app-config.service';
import { AppConfigResponseDto, UpdateAppConfigDto } from './dto';
import { EncryptionService } from '../common/encryption.service';

@Controller('settings/app')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class AppConfigController {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  @Get()
  @ApiOkResponse({ type: AppConfigResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'get', description: 'get operation' })
  async get() {
    const settings = this.appConfigService.getAppSettingsRaw();
    if (!settings) return {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = { ...settings };
    if (response.smtpPassEncrypted) {
      response.smtpPass = '********';
    }
    delete response.smtpPassEncrypted;

    return response;
  }

  @Patch()
  @ApiBody({ type: UpdateAppConfigDto })
  @ApiOkResponse({ type: AppConfigResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  async update(
    @Body()
    dto: UpdateAppConfigDto,
    @AuthUser() user: JwtUser,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = { ...dto };
    if (updatePayload.smtpPass) {
      updatePayload.smtpPassEncrypted = this.encryptionService.encrypt(
        updatePayload.smtpPass,
      );
      delete updatePayload.smtpPass;
    }

    const updated = await this.appConfigService.update(
      updatePayload,
      user?.userId,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = { ...updated };
    if (response.smtpPassEncrypted) {
      response.smtpPass = '********';
    }
    delete response.smtpPassEncrypted;

    return response;
  }
}
