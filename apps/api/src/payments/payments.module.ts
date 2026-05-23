import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { GlModule } from '../gl/gl.module';

import { AbaGeneratorService } from './aba-generator.service';

@Module({
  imports: [DrizzleModule, GlModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AbaGeneratorService],
})
export class PaymentsModule {}
