import { Module, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT, SystemResource } from '@herobm/shared';
import { GlService } from './gl.service';
import { GlController } from './gl.controller';
import { CoaLoaderService } from './coa-loader.service';
import { SettingsModule } from '../settings/settings.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { BankFeedsController } from './bank-feeds.controller';
import { BankFeedsService } from './bank-feeds.service';
import { BankStatementController } from './bank-statement.controller';
import { BankStatementService } from './bank-statement.service';
import { FxRevaluationService } from './fx-revaluation.service';
import { PeriodCloseAuditService } from '../pdf-templates/period-close-audit.service';
import { CashFlowService } from './cash-flow.service';
import { AccountingCodesService } from './accounting-codes.service';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';

import { BusinessReportsModule } from '../business-reports/business-reports.module';

@Module({
  imports: [SettingsModule, BusinessReportsModule],
  controllers: [
    GlController,
    ReconciliationController,
    BankFeedsController,
    BankStatementController,
  ],
  providers: [
    GlService,
    CoaLoaderService,
    ReconciliationService,
    BankFeedsService,
    BankStatementService,
    FxRevaluationService,
    PeriodCloseAuditService,
    CashFlowService,
    AccountingCodesService,
  ],
  exports: [
    GlService,
    CoaLoaderService,
    ReconciliationService,
    BankFeedsService,
    BankStatementService,
    FxRevaluationService,
    PeriodCloseAuditService,
    CashFlowService,
    AccountingCodesService,
  ],
})
export class GlModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly periodCloseAuditService: PeriodCloseAuditService,
    private readonly cashFlowService: CashFlowService,
    private readonly accountingCodesService: AccountingCodesService,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.PERIOD_CLOSE_AUDIT, {
      requiredPermissions: [
        { resource: SystemResource.GL, action: 'read' },
        { resource: SystemResource.FISCAL_PERIODS, action: 'read' },
      ],
      resolveData: async (
        id: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Context user
        user: any,
        options?: Record<string, unknown>,
      ) => {
        return (await this.periodCloseAuditService.assembleData(
          id,
          user,
          options,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        return this.periodCloseAuditService.getRandomId();
      },
      generateMockData: () => {
        return this.periodCloseAuditService.generateMockData() as unknown as Record<
          string,
          unknown
        >;
      },
    });

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.CASH_FLOW_STATEMENT, {
      requiredPermissions: [
        { resource: SystemResource.GL, action: 'read' },
        { resource: SystemResource.FISCAL_PERIODS, action: 'read' },
      ],
      resolveData: async (
        id: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Context user
        user: any,
        options?: Record<string, unknown>,
      ) => {
        return (await this.cashFlowService.assembleData(
          id,
          user,
          options,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        return this.cashFlowService.getRandomId();
      },
      generateMockData: () => {
        return this.cashFlowService.generateMockData() as unknown as Record<
          string,
          unknown
        >;
      },
    });

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.ACCOUNTING_CODES, {
      requiredPermissions: [{ resource: SystemResource.GL, action: 'read' }],
      resolveData: async (
        id: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Context user
        user: any,
        options?: Record<string, unknown>,
      ) => {
        return (await this.accountingCodesService.assembleData(
          id,
          user,
          options,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        return this.accountingCodesService.getRandomId();
      },
      generateMockData: () => {
        return this.accountingCodesService.generateMockData() as unknown as Record<
          string,
          unknown
        >;
      },
    });
  }
}
