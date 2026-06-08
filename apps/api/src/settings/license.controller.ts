import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { LicenseService, LicenseStatus } from './license.service';
import { SkipCasbin } from '../auth/casbin.guard';

import { ThrottlerGuard } from '@nestjs/throttler';

export class LicenseStatusDto implements LicenseStatus {
  // eslint-disable-next-line no-restricted-syntax
  @ApiProperty({ enum: ['active', 'warning', 'read_only'] })
  state!: 'active' | 'warning' | 'read_only';

  @ApiProperty({ enum: ['trial', 'perpetual', 'none'] })
  type!: 'trial' | 'perpetual' | 'none';

  @ApiProperty({ type: Date, nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  warningMessage!: string | null;

  @ApiProperty({ type: String, nullable: true })
  systemId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  licenseHash!: string | null;
}

// Allow anyone with a valid token to view or apply a license.
// This is critical because if the system is read-only, an admin still needs
// to be able to apply the license key to recover.
@Controller('settings')
@UseGuards(AuthGuard(['jwt']), ThrottlerGuard)
@SkipCasbin()
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('license-status')
  @SkipCasbin()
  @ApiOkResponse({ type: LicenseStatusDto })
  async getStatus(): Promise<LicenseStatus> {
    return this.licenseService.getStatus();
  }

  @Post('license')
  @SkipCasbin()
  @ApiCreatedResponse({ type: LicenseStatusDto })
  @ApiBody({
    schema: { type: 'object', properties: { licenseKey: { type: 'string' } } },
  })
  async applyLicense(
    @Body() dto: { licenseKey: string },
  ): Promise<LicenseStatus> {
    return this.licenseService.applyLicense(dto.licenseKey);
  }
}
