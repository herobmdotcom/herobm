import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
/* eslint-disable no-restricted-syntax -- globally skipping throttler guard */
import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { SkipCasbin } from './casbin.guard';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/config/throttler.config';
import {
  LoginDto,
  LoginResponseDto,
  MeResponseDto,
  Verify2FaLoginDto,
  Enable2FaDto,
  Enable2FaResponseDto,
  Disable2FaDto,
  Disable2FaResponseDto,
  RegenerateBackupCodesDto,
  RegenerateBackupCodesResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorStatusDto,
  EmptyBodyDto,
} from './dto';
import { Enforcer } from 'casbin';
import { CASBIN_ENFORCER } from './casbin.provider';
import { Inject } from '@nestjs/common';
import { AuthUser } from './auth-user.decorator';
import type { JwtUser } from './auth-user.decorator';

import { Public } from './public.decorator';

@ApiTags('System')
@Controller('auth')
@SkipCasbin()
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
    @Inject(CASBIN_ENFORCER) private enforcer: Enforcer,
  ) {}

  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @SkipCasbin()
  @Public()
  @Throttle({
    default: RATE_LIMITS.AUTH_LOGIN,
  })
  @ApiOperation({
    summary: 'Login User',
    description:
      'Authenticates a user and returns a JWT token, or a temp token if 2FA is required.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('2fa/verify-login')
  @ApiBody({ type: Verify2FaLoginDto })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @SkipCasbin()
  @Public()
  @Throttle({
    default: RATE_LIMITS.AUTH_2FA_VERIFY,
  })
  @ApiOperation({
    summary: 'Verify 2FA Login',
    description:
      'Completes the two-factor authentication login by verifying a TOTP code or backup code.',
  })
  async verify2FaLogin(@Body() dto: Verify2FaLoginDto) {
    return this.authService.verify2FaLogin(dto.tempToken, dto.code);
  }

  // ── 2FA Self-Service Endpoints ──────────────────────────────────────

  @Post('2fa/setup')
  @ApiBody({ type: EmptyBodyDto })
  @SkipCasbin()
  @ApiCreatedResponse({ type: TwoFactorSetupResponseDto })
  @ApiOperation({
    summary: 'Setup 2FA',
    description:
      'Generates a TOTP secret, QR code, and backup codes for two-factor authentication setup.',
  })
  async setup2Fa(@AuthUser() user: JwtUser, @Body() _dto: EmptyBodyDto) {
    return this.twoFactorService.generateSetup(user.userId, user.username);
  }

  @Post('2fa/enable')
  @ApiBody({ type: Enable2FaDto })
  @ApiCreatedResponse({ type: Enable2FaResponseDto })
  @SkipCasbin()
  @ApiOperation({
    summary: 'Enable 2FA',
    description:
      'Enables two-factor authentication after verifying the setup code.',
  })
  async enable2Fa(@AuthUser() user: JwtUser, @Body() dto: Enable2FaDto) {
    const setup = await this.twoFactorService.generateSetup(
      user.userId,
      user.username,
    );
    await this.twoFactorService.enable(
      user.userId,
      dto.code,
      dto.secret,
      setup.backupCodes,
      user.username,
    );
    return { enabled: true, backupCodes: setup.backupCodes };
  }

  @Post('2fa/disable')
  @ApiBody({ type: Disable2FaDto })
  @ApiCreatedResponse({ type: Disable2FaResponseDto })
  @SkipCasbin()
  @ApiOperation({
    summary: 'Disable 2FA',
    description:
      'Disables two-factor authentication. Requires password and current TOTP code.',
  })
  async disable2Fa(@AuthUser() user: JwtUser, @Body() dto: Disable2FaDto) {
    await this.twoFactorService.disable(
      user.userId,
      dto.password,
      dto.code,
      user.username,
    );
    return { disabled: true };
  }

  @Post('2fa/backup-codes/regenerate')
  @ApiBody({ type: RegenerateBackupCodesDto })
  @ApiCreatedResponse({ type: RegenerateBackupCodesResponseDto })
  @SkipCasbin()
  @ApiOperation({
    summary: 'Regenerate Backup Codes',
    description:
      'Regenerates two-factor authentication backup codes. Requires password and current TOTP code.',
  })
  async regenerateBackupCodes(
    @AuthUser() user: JwtUser,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    return this.twoFactorService.regenerateBackupCodes(
      user.userId,
      dto.password,
      dto.code,
      user.username,
    );
  }

  @Get('2fa/status')
  @SkipCasbin()
  @ApiOkResponse({ type: TwoFactorStatusDto })
  @ApiOperation({
    summary: 'Get 2FA Status',
    description:
      'Returns whether two-factor authentication is enabled for the current user.',
  })
  async get2FaStatus(@AuthUser() user: JwtUser) {
    return this.twoFactorService.getStatus(user.userId);
  }

  // ── Existing Endpoints ──────────────────────────────────────────────

  /** Return the current user's identity from JWT — used by frontend for role-aware UI. */
  @Get('me')
  @ApiOkResponse({ type: MeResponseDto })
  @SkipCasbin()
  @Throttle({
    default: RATE_LIMITS.AUTH_ME,
  })
  @ApiOperation({
    summary: 'Get Current User',
    description:
      'Returns the identity and role of the currently authenticated user.',
  })
  async me(
    @Request()
    req: {
      user: {
        userId?: string;
        username: string;
        displayName?: string | null;
        role: string;
      };
    },
  ) {
    const implicitPolicies = await this.enforcer.getImplicitPermissionsForUser(
      req.user.role,
    );
    const permissions = implicitPolicies.map((p) => ({
      resource: p[1],
      action: p[2],
      effect: p[3] || 'allow',
    }));

    return {
      username: req.user.username,
      displayName: req.user.displayName,
      role: req.user.role,
      permissions,
    };
  }
}
