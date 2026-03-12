import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SkipCasbin } from './casbin.guard';

class LoginDto {
  username!: string;
  password!: string;
}

@Controller('auth')
@SkipCasbin()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
