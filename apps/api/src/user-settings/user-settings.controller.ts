import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipCasbin } from '../auth/casbin.guard';
import { UserSettingsService } from './user-settings.service';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import {
  UpdateUserSettingsDto,
  UserSettingsResponseDto,
} from './user-settings.dto';

@ApiTags('System')
@Controller('user-settings')
@UseGuards(AuthGuard(['jwt', 'api-key']), ThrottlerGuard) // Note: No CasbinGuard needed as users always can access their own settings
@SkipCasbin()
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  @SkipCasbin()
  @ApiOperation({
    summary: 'Get user settings',
    description: 'Retrieves the settings for the currently authenticated user.',
  })
  @ApiOkResponse({ type: UserSettingsResponseDto })
  async getSettings(@AuthUser() user: JwtUser) {
    return this.service.getSettings(user.userId);
  }

  @Patch()
  @SkipCasbin()
  @ApiOperation({
    summary: 'Update user settings',
    description:
      'Updates specific sections of the settings for the currently authenticated user.',
  })
  @ApiBody({ type: UpdateUserSettingsDto })
  @ApiOkResponse({ type: UserSettingsResponseDto })
  async updateSettings(
    @AuthUser() user: JwtUser,
    @Body() body: UpdateUserSettingsDto,
  ) {
    return this.service.updateSettings(user.userId, body);
  }
}
