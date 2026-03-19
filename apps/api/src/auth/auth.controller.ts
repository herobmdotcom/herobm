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

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

@Controller('auth')
@SkipCasbin()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @SkipCasbin()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  /** Return the current user's identity from JWT — used by frontend for role-aware UI. */
  @Get('me')
  @SkipCasbin()
  @UseGuards(AuthGuard('jwt'))
  me(@Request() req: any) {
    return {
      username: req.user.username,
      role: req.user.role,
    };
  }
}
