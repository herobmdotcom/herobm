import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CasbinGuard } from './casbin.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: (() => {
        const s = process.env.JWT_SECRET;
        if (!s) throw new Error('FATAL: JWT_SECRET environment variable is not set. Check your .env file.');
        return s;
      })(),
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CasbinGuard],
  exports: [CasbinGuard, JwtStrategy, PassportModule],
})
export class AuthModule {}
