import { Module, Inject, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import { customers } from '@herobm/db-schema';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersWriteService } from './customers-write.service';
import { CustomerGroupsController } from './customer-groups.controller';
import { CustomerGroupsService } from './customer-groups.service';
import { CreditAssessmentService } from './credit-assessment.service';
import { CustomerStatementService } from '../pdf-templates/customer-statement.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CustomersController, CustomerGroupsController],
  providers: [
    CustomersService,
    CustomersWriteService,
    CustomerGroupsService,
    CreditAssessmentService,
    CustomerStatementService,
  ],
  exports: [
    CustomersService,
    CustomersWriteService,
    CustomerGroupsService,
    CreditAssessmentService,
    CustomerStatementService,
  ],
})
export class CustomersModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly customerStatementService: CustomerStatementService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.CUSTOMER_STATEMENT, {
      requiredPermissions: [{ resource: 'customers', action: 'read' }],
      resolveData: async (
        id: string,
        _user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        return (await this.customerStatementService.assembleData(
          id,
          options,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: customers.customerId })
          .from(customers)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });
  }
}
