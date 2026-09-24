import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
  locations,
  bins,
  zones,
  binContents,
  products,
} from '@herobm/db-schema';
import {
  STOCKTAKE_STATE,
  STOCKTAKE_TRANSITIONS,
  getAllowedTransitions,
  type StocktakeState,
} from '@herobm/shared';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import { InventoryMovementService } from '../inventory-movement.service';
import { StocktakesCountsWriteService } from './stocktakes-counts-write.service';
import type {
  CreateStocktakeDto,
  UpdateStocktakeDto,
  RecordStocktakeCountDto,
  BatchRecordStocktakeCountsDto,
  AddStocktakeUnlistedProductDto,
  UpdateStocktakeLineDto,
  StocktakeStateTransitionDto,
  SubmitStocktakeDto,
} from './dto';

@Injectable()
export class StocktakesWriteService {
  private readonly logger = new Logger(StocktakesWriteService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly stocktakesCountsWriteService: StocktakesCountsWriteService,
  ) {}

  private async generateStocktakeNumber(
    tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `STK-${dateStr}-`;

    const [latest] = await tx
      .select({ stocktakeNumber: stocktakes.stocktakeNumber })
      .from(stocktakes)
      .where(sql`${stocktakes.stocktakeNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${stocktakes.stocktakeNumber} DESC`)
      .limit(1);

    let nextSeq = 1;
    if (latest && latest.stocktakeNumber) {
      const parts = latest.stocktakeNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  async create(
    dto: CreateStocktakeDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      // 1. Verify location exists
      const [loc] = await tx
        .select({
          locationId: locations.locationId,
          code: locations.code,
          name: locations.name,
        })
        .from(locations)
        .where(eq(locations.locationId, dto.locationId))
        .limit(1);

      if (!loc) {
        throw new NotFoundException(`Location ${dto.locationId} not found`);
      }

      // 2. Generate stocktake number
      const stocktakeNumber = await this.generateStocktakeNumber(tx);

      // 3. Create stocktake header
      const [stocktake] = await tx
        .insert(stocktakes)
        .values({
          stocktakeNumber,
          name: dto.name,
          locationId: dto.locationId,
          stateCode: STOCKTAKE_STATE.OPEN,
          scopeType: dto.scopeType,
          zoneFilter: dto.zoneFilter || null,
          binPattern: dto.binPattern || null,
          isBlindCount: Boolean(dto.isBlindCount),
          notes: dto.notes || null,
          createdBy: username,
          createdOn: new Date(),
          openedBy: username,
          openedAt: new Date(),
          modifiedOn: new Date(),
        })
        .returning();

      // 4. Snapshot initial lines from bin_contents if scope is full, zone, or bin_pattern
      if (dto.scopeType !== 'manual') {
        const binConditions = [eq(zones.locationId, dto.locationId)];

        if (dto.scopeType === 'zone' && dto.zoneFilter?.trim()) {
          binConditions.push(
            eq(sql`UPPER(${zones.code})`, dto.zoneFilter.trim().toUpperCase()),
          );
        }
        if (dto.scopeType === 'bin_pattern' && dto.binPattern?.trim()) {
          const pat = dto.binPattern.trim().toUpperCase();
          binConditions.push(
            or(
              sql`UPPER(${bins.binNumber}) LIKE ${pat + '%'}`,
              sql`UPPER(${zones.code}) LIKE ${pat + '%'}`,
            )!,
          );
        }

        const snapshotRows = await tx
          .select({
            binId: binContents.binId,
            productId: binContents.productId,
            actualQuantity: binContents.actualQuantity,
          })
          .from(binContents)
          .innerJoin(bins, eq(binContents.binId, bins.binId))
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              ...binConditions,
              sql`${binContents.actualQuantity}::numeric > 0`,
            ),
          );

        if (snapshotRows.length > 0) {
          const lineInserts = snapshotRows.map((row) => ({
            stocktakeId: stocktake.stocktakeId,
            productId: row.productId,
            binId: row.binId,
            expectedQuantity: row.actualQuantity,
            countedQuantity: null,
            isUnlisted: false,
          }));

          await tx.insert(stocktakeLines).values(lineInserts);
        }
      }

      // 5. Emit audit event
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: stocktake.stocktakeId,
        eventType: EventType.CREATED,
        entityDisplayName: stocktake.stocktakeNumber,
        payload: {
          stocktakeId: stocktake.stocktakeId,
          stocktakeNumber: stocktake.stocktakeNumber,
          name: stocktake.name,
          locationId: stocktake.locationId,
          locationName: loc.name,
          scopeType: stocktake.scopeType,
        },
        actor: username,
      });

      return stocktake;
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  async update(
    id: string,
    dto: UpdateStocktakeDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const [existing] = await tx
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.stocktakeId, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Stocktake ${id} not found`);
      }

      if (
        existing.stateCode === STOCKTAKE_STATE.SUBMITTED ||
        existing.stateCode === STOCKTAKE_STATE.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot modify stocktake in ${existing.stateCode} state`,
        );
      }

      const updateData: Partial<typeof stocktakes.$inferInsert> = {
        modifiedOn: new Date(),
      };

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.isBlindCount !== undefined)
        updateData.isBlindCount = dto.isBlindCount;

      const [updated] = await tx
        .update(stocktakes)
        .set(updateData)
        .where(eq(stocktakes.stocktakeId, id))
        .returning();

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: updated.stocktakeId,
        eventType: EventType.UPDATED,
        entityDisplayName: updated.stocktakeNumber,
        payload: dto,
        actor: username,
      });

      return updated;
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  async changeState(
    id: string,
    dto: StocktakeStateTransitionDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const [existing] = await tx
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.stocktakeId, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Stocktake ${id} not found`);
      }

      const allowed = getAllowedTransitions(
        STOCKTAKE_TRANSITIONS,
        existing.stateCode,
      );
      if (!allowed.includes(dto.stateCode)) {
        throw new BadRequestException(
          `Cannot transition stocktake from ${existing.stateCode} to ${dto.stateCode}. Allowed transitions: ${allowed.join(', ')}`,
        );
      }

      if (dto.stateCode === STOCKTAKE_STATE.SUBMITTED) {
        return this.submitReconciliation(
          id,
          {
            reason:
              dto.notes || `Reconciled Stocktake ${existing.stocktakeNumber}`,
          },
          username,
          tx,
        );
      }

      const updateData: Partial<typeof stocktakes.$inferInsert> = {
        stateCode: dto.stateCode,
        modifiedOn: new Date(),
      };

      if (dto.stateCode === STOCKTAKE_STATE.OPEN && !existing.openedAt) {
        updateData.openedBy = username;
        updateData.openedAt = new Date();
      } else if (dto.stateCode === STOCKTAKE_STATE.REVIEW) {
        updateData.reviewedBy = username;
        updateData.reviewedAt = new Date();
      } else if (dto.stateCode === STOCKTAKE_STATE.CANCELLED) {
        updateData.cancelledBy = username;
        updateData.cancelledAt = new Date();
      }

      const updated = await this.changeStocktakeState(
        id,
        dto.stateCode,
        updateData,
        tx,
      );

      // @herobm-skip-audit Delegated DB write to changeStocktakeState
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: updated.stocktakeId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.stocktakeNumber,
        payload: {
          previousState: existing.stateCode,
          newState: dto.stateCode,
          notes: dto.notes,
        },
        actor: username,
      });

      return updated;
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  /**
   * @herobm-skip-audit State transition helper; audit event emitted by caller
   */
  private async changeStocktakeState(
    id: string,
    stateCode: StocktakeState,
    updateFields: Partial<typeof stocktakes.$inferInsert>,
    tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
  ) {
    const [updated] = await tx
      .update(stocktakes)
      .set({
        ...updateFields,
        stateCode,
        modifiedOn: new Date(),
      })
      .where(eq(stocktakes.stocktakeId, id))
      .returning();

    return updated;
  }

  async recordCount(
    id: string,
    dto: RecordStocktakeCountDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.recordCount(
      id,
      dto,
      username,
      passedTx,
    );
  }

  async recordBatchCounts(
    id: string,
    dto: BatchRecordStocktakeCountsDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.recordBatchCounts(
      id,
      dto,
      username,
      passedTx,
    );
  }

  async addUnlistedProduct(
    id: string,
    dto: AddStocktakeUnlistedProductDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.addUnlistedProduct(
      id,
      dto,
      username,
      passedTx,
    );
  }

  async markBinEmpty(
    id: string,
    binId: string,
    username: string,
    notes?: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.markBinEmpty(
      id,
      binId,
      username,
      notes,
      passedTx,
    );
  }

  async updateLine(
    id: string,
    lineId: string,
    dto: UpdateStocktakeLineDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.updateLine(
      id,
      lineId,
      dto,
      username,
      passedTx,
    );
  }

  async deleteLine(
    id: string,
    lineId: string,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    return this.stocktakesCountsWriteService.deleteLine(
      id,
      lineId,
      username,
      passedTx,
    );
  }

  async submitReconciliation(
    id: string,
    dto: SubmitStocktakeDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      // 1. Pessimistic lock on stocktake record
      const [stocktake] = await tx
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.stocktakeId, id))
        .for('update')
        .limit(1);

      if (!stocktake) {
        throw new NotFoundException(`Stocktake ${id} not found`);
      }

      if (stocktake.stateCode === STOCKTAKE_STATE.SUBMITTED) {
        throw new ConflictException(
          `Stocktake ${stocktake.stocktakeNumber} has already been submitted`,
        );
      }

      if (stocktake.stateCode === STOCKTAKE_STATE.CANCELLED) {
        throw new BadRequestException('Cannot submit a cancelled stocktake');
      }

      // 2. Reject submission if any uncounted lines exist
      const [uncountedRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(stocktakeLines)
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            sql`${stocktakeLines.countedQuantity} is null`,
          ),
        );

      if (uncountedRow && uncountedRow.count > 0) {
        throw new BadRequestException(
          `Cannot submit stocktake: ${uncountedRow.count} item(s) remain uncounted. All bins/items must be counted or explicitly marked as empty.`,
        );
      }

      // 3. Fetch all counted lines for this stocktake
      const countedLines = await tx
        .select({
          line: stocktakeLines,
          productUom: products.baseUom,
        })
        .from(stocktakeLines)
        .innerJoin(products, eq(stocktakeLines.productId, products.productId))
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            sql`${stocktakeLines.countedQuantity} is not null`,
          ),
        );

      // 3. Batch pre-fetch live bin_contents quantities to eliminate N+1 queries
      const productIds = Array.from(
        new Set(countedLines.map((r) => r.line.productId)),
      );
      const binIds = Array.from(new Set(countedLines.map((r) => r.line.binId)));

      const liveContentsMap = new Map<string, number>();
      if (productIds.length > 0 && binIds.length > 0) {
        const liveContents = await tx
          .select({
            binId: binContents.binId,
            productId: binContents.productId,
            actualQuantity: binContents.actualQuantity,
          })
          .from(binContents)
          .where(
            and(
              inArray(binContents.productId, productIds),
              inArray(binContents.binId, binIds),
            ),
          );

        for (const content of liveContents) {
          liveContentsMap.set(
            `${content.productId}:${content.binId}`,
            parseFloat(content.actualQuantity || '0'),
          );
        }
      }

      const movements: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];

      for (const row of countedLines) {
        const line = row.line;
        const targetPhysicalQty = parseFloat(line.countedQuantity || '0');
        const currentLiveQty =
          liveContentsMap.get(`${line.productId}:${line.binId}`) || 0;
        const delta = targetPhysicalQty - currentLiveQty;

        if (Math.abs(delta) > 0.0001) {
          movements.push({
            productId: line.productId,
            binId: line.binId,
            quantity: delta,
            uomCode: row.productUom || 'EA',
          });
        }
      }

      let entryId: string | null = null;

      // 4. Post inventory movements if variances exist
      if (movements.length > 0) {
        const movementResult =
          await this.inventoryMovementService.recordInventoryMovement(tx, {
            entryNumber: `ADJ-${stocktake.stocktakeNumber}`,
            sourceType: 'MANUAL_ADJUST',
            sourceId: id,
            memo: dto.reason || `Stocktake ${stocktake.stocktakeNumber}`,
            userId: username,
            lines: movements,
          });

        if (movementResult) {
          entryId = movementResult.entryId;
        }
      }

      // 5. Update stocktake state to SUBMITTED
      const submittedStocktake = await this.changeStocktakeState(
        id,
        STOCKTAKE_STATE.SUBMITTED,
        {
          submittedBy: username,
          submittedOn: new Date(),
          inventoryEntryId: entryId,
        },
        tx,
      );

      // 6. Emit event
      // @herobm-skip-audit Delegated DB write to changeStocktakeState
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: id,
        eventType: EventType.SUBMITTED,
        entityDisplayName: stocktake.stocktakeNumber,
        payload: {
          stocktakeNumber: stocktake.stocktakeNumber,
          reconciledLinesCount: movements.length,
          inventoryEntryId: entryId,
          reason: dto.reason,
        },
        actor: username,
      });

      return {
        success: true,
        stocktakeId: id,
        stocktakeNumber: stocktake.stocktakeNumber,
        stateCode: STOCKTAKE_STATE.SUBMITTED,
        reconciledCount: movements.length,
        inventoryEntryId: entryId || undefined,
      };
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  async delete(
    id: string,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const [existing] = await tx
        .select()
        .from(stocktakes)
        .where(eq(stocktakes.stocktakeId, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Stocktake ${id} not found`);
      }

      if (existing.stateCode !== STOCKTAKE_STATE.DRAFT) {
        throw new BadRequestException(
          `Cannot delete stocktake in ${existing.stateCode} state. Only draft stocktakes can be deleted.`,
        );
      }

      await tx.delete(stocktakes).where(eq(stocktakes.stocktakeId, id));

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: existing.stocktakeNumber,
        payload: { stocktakeNumber: existing.stocktakeNumber },
        actor: username,
      });

      return { success: true };
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }
}
