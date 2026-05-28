import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SkipCasbin } from './casbin.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto, LoginResponseDto, MeResponseDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
@SkipCasbin()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiCreatedResponse({ type: LoginResponseDto })
  @SkipCasbin()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: process.env.NODE_ENV === 'test' ? 100 : 5, ttl: 60000 },
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
  @SkipCasbin()
  @UseGuards(AuthGuard(['jwt', 'api-key']))
  @ApiOperation({
    summary: 'Get Current User',
    description:
      'Returns the identity and role of the currently authenticated user.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  me(@Request() req: any) {
    return {
      username: req.user.username,
      role: req.user.role,
    };
  }
}
