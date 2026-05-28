import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [ApiKeysController],
})
export class ApiKeysModule {}
