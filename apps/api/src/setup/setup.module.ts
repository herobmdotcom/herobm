import { Module } from '@nestjs/common';
import { SetupWebhookController } from './setup-webhook.controller';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';

import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [SetupController, SetupWebhookController],
  providers: [SetupService],
})
export class SetupModule {}
