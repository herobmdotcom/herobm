import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiProperty,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { LicenseService, LicenseStatus } from './license.service';
import { SkipCasbin } from '../auth/casbin.guard';

import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ============================================================================
 * LEGAL & COMPLIANCE WARNING
 * ============================================================================
 * Modifying, bypassing, or removing this license validation code constitutes
 * a direct breach of the End User License Agreement (EULA).
 *
 * Unauthorized circumvention of this technical protection measure is unethical,
 * violates intellectual property rights, and may result in immediate revocation
 * of your license, civil litigation, significant financial damages, and
 * potential criminal penalties under applicable copyright laws (e.g., DMCA).
 * ============================================================================
 */
import { ApplyLicenseDto } from './dto';

export class LicenseStatusDto implements LicenseStatus {
  // eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Swagger Metadata).
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
@ApiTags('System')
@Controller('settings')
@UseGuards(ThrottlerGuard)
@SkipCasbin()
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('license-status')
  @SkipCasbin()
  @ApiOperation({
    summary: 'Get License Status',
    description: 'Get the current license status.',
  })
  @ApiOkResponse({ type: LicenseStatusDto })
  async getStatus(): Promise<LicenseStatus> {
    return this.licenseService.getStatus();
  }

  @Post('license')
  @SkipCasbin()
  @ApiOperation({
    summary: 'Apply License',
    description: 'Apply a new license key.',
  })
  @ApiCreatedResponse({ type: LicenseStatusDto })
  @ApiBody({
    schema: { type: 'object', properties: { licenseKey: { type: 'string' } } },
  })
  async applyLicense(@Body() dto: ApplyLicenseDto): Promise<LicenseStatus> {
    return this.licenseService.applyLicense(dto.licenseKey);
  }
}
