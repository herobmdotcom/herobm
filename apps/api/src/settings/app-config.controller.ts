import { SystemResource } from '@herobm/shared';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { Controller, Patch, Body, Get } from '@nestjs/common';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { AppConfigService } from './app-config.service';
import { AppConfigResponseDto, UpdateAppConfigDto } from './dto';
import { EncryptionService } from '../common/encryption.service';

type AppConfigResponse = Partial<AppConfigResponseDto> & {
  smtpPassEncrypted?: string | null;
  [key: string]: unknown;
};

interface UpdatePayload extends Partial<UpdateAppConfigDto> {
  smtpPassEncrypted?: string;
}

@Controller('settings/app')
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
  async get(): Promise<AppConfigResponseDto> {
    const settings = this.appConfigService.getAppSettingsRaw();
    if (!settings) return {} as AppConfigResponseDto;

    const response = { ...settings } as AppConfigResponse;
    if (response.smtpPassEncrypted) {
      response.smtpPass = '********';
    }
    delete response.smtpPassEncrypted;

    return response as unknown as AppConfigResponseDto;
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
    const updatePayload: UpdatePayload = { ...dto };
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
    const response = { ...updated } as AppConfigResponse;
    if (response.smtpPassEncrypted) {
      response.smtpPass = '********';
    }
    delete response.smtpPassEncrypted;

    return response;
  }
}
