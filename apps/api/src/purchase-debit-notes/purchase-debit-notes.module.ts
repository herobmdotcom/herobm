import { Module } from '@nestjs/common';
import { PurchaseDebitNotesController } from './purchase-debit-notes.controller';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import { SettingsModule } from '../settings/settings.module';
import { GlModule } from '../gl/gl.module';

@Module({
  imports: [SettingsModule, GlModule],
  controllers: [PurchaseDebitNotesController],
  providers: [PurchaseDebitNotesService],
  exports: [PurchaseDebitNotesService],
})
export class PurchaseDebitNotesModule {}
