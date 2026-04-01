import { Module, OnModuleInit } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRegistry } from './reports.registry';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRegistry],
  exports: [ReportsService, ReportsRegistry],
})
export class ReportsModule implements OnModuleInit {
  constructor(private readonly reportsRegistry: ReportsRegistry) {}

  onModuleInit() {
    this.reportsRegistry.register('theme', {
      resolveData: async (id: string, user: any) => {
        // Return dummy organization data or empty for now.
        // Usually would fetch the active tenant's org info from the DB.
        return {
          orgName: 'MODBM Demo Organization',
          orgAddress: '123 Enterprise Way',
          orgEmail: 'contact@demo.org',
          orgPhone: '+1-555-0100',
        };
      },
      getRandomId: async () => '1', // Theme contexts usually don't depend on specific IDs
    });
  }
}
