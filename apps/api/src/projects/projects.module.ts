import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsResourcesService } from './projects-resources.service';
import { ProjectsInventoryService } from './projects-inventory.service';
import { ProjectsTasksService } from './projects-tasks.service';
import { ProjectsBudgetService } from './projects-budget.service';
import { ProjectsLedgerService } from './projects-ledger.service';
import { ProjectsNotesService } from './projects-notes.service';
import { ProjectsBillingService } from './projects-billing.service';
import { ProjectsSettingsService } from './projects-settings.service';
import { InventoryModule } from '../inventory/inventory.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    forwardRef(() => InventoryModule),
    forwardRef(() => InvoicesModule),
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsResourcesService,
    ProjectsInventoryService,
    ProjectsTasksService,
    ProjectsBudgetService,
    ProjectsLedgerService,
    ProjectsNotesService,
    ProjectsBillingService,
    ProjectsSettingsService,
  ],
  exports: [
    ProjectsService,
    ProjectsResourcesService,
    ProjectsInventoryService,
    ProjectsTasksService,
    ProjectsBudgetService,
    ProjectsLedgerService,
    ProjectsNotesService,
    ProjectsBillingService,
    ProjectsSettingsService,
  ],
})
export class ProjectsModule {}
