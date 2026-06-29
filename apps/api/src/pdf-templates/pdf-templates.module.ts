import { Module, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { PdfTemplatesController } from './pdf-templates.controller';
import { PdfTemplatesService } from './pdf-templates.service';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [PdfTemplatesController],
  providers: [PdfTemplatesService],
  exports: [PdfTemplatesService],
})
export class PdfTemplatesModule implements OnModuleInit {
  constructor(private readonly dataSourcesRegistry: DataSourcesRegistry) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.THEME, {
      resolveData: async (id: string, user: unknown) => {
        // Return dummy organization data or empty for now.
        // Usually would fetch the active tenant's org info from the DB.
        return {
          orgName: 'HEROBM Demo Organization',
          orgAddress: '123 Enterprise Way',
          orgEmail: 'contact@demo.org',
          orgPhone: '+1-555-0100',
        };
      },
      getRandomId: async () => '1', // Theme contexts usually don't depend on specific IDs
    });
  }
}
