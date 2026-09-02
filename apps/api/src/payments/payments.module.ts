import { Module, Inject, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import { paymentEntries } from '@herobm/db-schema';
import { DRIZZLE, DrizzleModule } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { PaymentsController } from './payments.controller';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsWriteService } from './payments-write.service';
import { PaymentsAllocationService } from './payments-allocation.service';
import { PaymentsPostingService } from './payments-posting.service';
import { GlModule } from '../gl/gl.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { PaymentRunGeneratorService } from './payment-run-generator.service';
import { SupplierRemittanceAdviceService } from '../pdf-templates/supplier-remittance-advice.service';
import { CustomerPaymentReceiptService } from '../pdf-templates/customer-payment-receipt.service';

@Module({
  imports: [DrizzleModule, GlModule, SuppliersModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsCoreService,
    PaymentsWriteService,
    PaymentsAllocationService,
    PaymentsPostingService,
    AbaGeneratorService,
    NachaGeneratorService,
    PaymentRunGeneratorService,
    SupplierRemittanceAdviceService,
    CustomerPaymentReceiptService,
  ],
  exports: [
    PaymentsCoreService,
    PaymentsWriteService,
    PaymentsAllocationService,
    PaymentsPostingService,
    SupplierRemittanceAdviceService,
    CustomerPaymentReceiptService,
  ],
})
export class PaymentsModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly supplierRemittanceAdviceService: SupplierRemittanceAdviceService,
    private readonly customerPaymentReceiptService: CustomerPaymentReceiptService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.SUPPLIER_REMITTANCE_ADVICE,
      {
        requiredPermissions: [{ resource: 'payments', action: 'read' }],
        resolveData: async (
          id: string,
          _user: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => {
          return (await this.supplierRemittanceAdviceService.assembleData(
            id,
            options,
          )) as unknown as Record<string, unknown>;
        },
        getRandomId: async () => {
          const rows = await this.db
            .select({ id: paymentEntries.paymentId })
            .from(paymentEntries)
            .orderBy(sql`RANDOM()`)
            .limit(1);
          return rows.length > 0 ? rows[0].id : undefined;
        },
      },
    );

    this.dataSourcesRegistry.register(
      DATA_SOURCE_CONTEXT.CUSTOMER_PAYMENT_RECEIPT,
      {
        requiredPermissions: [{ resource: 'payments', action: 'read' }],
        resolveData: async (
          id: string,
          _user: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => {
          return (await this.customerPaymentReceiptService.assembleData(
            id,
            options,
          )) as unknown as Record<string, unknown>;
        },
        getRandomId: async () => {
          const rows = await this.db
            .select({ id: paymentEntries.paymentId })
            .from(paymentEntries)
            .orderBy(sql`RANDOM()`)
            .limit(1);
          return rows.length > 0 ? rows[0].id : undefined;
        },
      },
    );
  }
}
