import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { SetupWebhookController } from './setup-webhook.controller';

import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [SetupController, SetupWebhookController],
  providers: [SetupService],
})
export class SetupModule {}
