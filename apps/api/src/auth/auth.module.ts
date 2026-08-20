import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CasbinGuard } from './casbin.guard';
import { CasbinEnforcerProvider, CASBIN_ENFORCER } from './casbin.provider';

import { ApiKeyStrategy } from './api-key.strategy';
import { EnvService } from '../common/config/env.service';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.jwtSecret,
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyStrategy,
    CasbinEnforcerProvider,
    CasbinGuard,
  ],
  exports: [
    CasbinGuard,
    CASBIN_ENFORCER,
    JwtStrategy,
    ApiKeyStrategy,
    PassportModule,
  ],
})
export class AuthModule {}
