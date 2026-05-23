import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';

import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
