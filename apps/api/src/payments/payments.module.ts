import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsWriteService } from './payments-write.service';
import { PaymentsAllocationService } from './payments-allocation.service';
import { PaymentsPostingService } from './payments-posting.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { GlModule } from '../gl/gl.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { PaymentRunGeneratorService } from './payment-run-generator.service';

@Module({
  imports: [DrizzleModule, GlModule, SuppliersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsCoreService,
    PaymentsWriteService,
    PaymentsAllocationService,
    PaymentsPostingService,
    AbaGeneratorService,
    NachaGeneratorService,
    PaymentRunGeneratorService,
  ],
})
export class PaymentsModule {}
