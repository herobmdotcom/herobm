import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, EncryptionService],
})
export class WebhooksModule {}
