import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [ApiKeysController],
})
export class ApiKeysModule {}
