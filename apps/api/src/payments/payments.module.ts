import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { GlModule } from '../gl/gl.module';

@Module({
  imports: [DrizzleModule, GlModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
