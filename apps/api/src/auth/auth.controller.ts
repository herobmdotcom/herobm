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
import { SkipCasbin } from './casbin.guard';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/config/throttler.config';
import { LoginDto, LoginResponseDto, MeResponseDto } from './dto';
import { Enforcer } from 'casbin';
import { CASBIN_ENFORCER } from './casbin.provider';
import { Inject } from '@nestjs/common';

import { Public } from './public.decorator';

@ApiTags('System')
@Controller('auth')
@SkipCasbin()
export class AuthController {
  constructor(
    private authService: AuthService,
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
    description: 'Authenticates a user and returns a JWT token.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

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
  async me(@Request() req: { user: { username: string; role: string } }) {
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
      role: req.user.role,
      permissions,
    };
  }
}
