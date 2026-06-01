import { Module } from '@nestjs/common';
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

@Module({
  imports: [SettingsModule],
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
  ],
  exports: [
    GlService,
    CoaLoaderService,
    ReconciliationService,
    BankFeedsService,
    BankStatementService,
  ],
})
export class GlModule {}
