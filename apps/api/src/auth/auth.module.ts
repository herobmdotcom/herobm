import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CasbinGuard } from './casbin.guard';

import { ApiKeyStrategy } from './api-key.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: (() => {
        const s = process.env.JWT_SECRET;
        if (!s)
          throw new Error(
            'FATAL: JWT_SECRET environment variable is not set. Check your .env file.',
          );
        return s;
      })(),
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ApiKeyStrategy, CasbinGuard],
  exports: [CasbinGuard, JwtStrategy, ApiKeyStrategy, PassportModule],
})
export class AuthModule {}
