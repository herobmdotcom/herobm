import { Module, Inject, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import { purchaseDebitNotes } from '@herobm/db-schema';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { PurchaseDebitNotesController } from './purchase-debit-notes.controller';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import { PurchaseDebitNoteService } from '../pdf-templates/purchase-debit-note.service';
import { SettingsModule } from '../settings/settings.module';
import { GlModule } from '../gl/gl.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SettingsModule, GlModule, NotificationsModule],
  controllers: [PurchaseDebitNotesController],
  providers: [PurchaseDebitNotesService, PurchaseDebitNoteService],
  exports: [PurchaseDebitNotesService, PurchaseDebitNoteService],
})
export class PurchaseDebitNotesModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly purchaseDebitNoteService: PurchaseDebitNoteService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.PURCHASE_DEBIT_NOTE, {
      requiredPermissions: [
        { resource: 'purchase-debit-notes', action: 'read' },
      ],
      resolveData: async (
        id: string,
        user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        return (await this.purchaseDebitNoteService.assembleData(
          id,
          options,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: purchaseDebitNotes.debitNoteId })
          .from(purchaseDebitNotes)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });
  }
}
