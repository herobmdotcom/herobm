import { Module } from '@nestjs/common';
import { GlService } from './gl.service';
import { GlController } from './gl.controller';
import { CoaLoaderService } from './coa-loader.service';
import { SettingsModule } from '../settings/settings.module';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [SettingsModule],
  controllers: [GlController, ReconciliationController],
  providers: [GlService, CoaLoaderService, ReconciliationService],
  exports: [GlService, CoaLoaderService, ReconciliationService],
})
export class GlModule {}
