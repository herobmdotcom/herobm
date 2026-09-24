import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
  bins,
  products,
} from '@herobm/db-schema';
import { STOCKTAKE_STATE } from '@herobm/shared';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import type {
  RecordStocktakeCountDto,
  BatchRecordStocktakeCountsDto,
  AddStocktakeUnlistedProductDto,
  UpdateStocktakeLineDto,
} from './dto';

@Injectable()
export class StocktakesCountsWriteService {
  private readonly logger = new Logger(StocktakesCountsWriteService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async recordCount(
    id: string,
    dto: RecordStocktakeCountDto,
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

      if (existing.stateCode !== STOCKTAKE_STATE.OPEN) {
        throw new BadRequestException(
          `Cannot record counts on stocktake in ${existing.stateCode} state. Stocktake must be open.`,
        );
      }

      // Check if line exists in stocktake
      const [line] = await tx
        .select()
        .from(stocktakeLines)
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            eq(stocktakeLines.productId, dto.productId),
            eq(stocktakeLines.binId, dto.binId),
          ),
        )
        .limit(1);

      const countQty = parseFloat(dto.quantity);
      if (isNaN(countQty) || countQty < 0) {
        throw new BadRequestException(
          'Count quantity must be a non-negative number',
        );
      }

      let lineId: string;
      let newCountedQty: number;

      if (line) {
        lineId = line.stocktakeLineId;
        if (dto.countMode === 'increment') {
          const current =
            line.countedQuantity !== null
              ? parseFloat(line.countedQuantity)
              : 0;
          newCountedQty = current + countQty;
        } else {
          newCountedQty = countQty;
        }

        await tx
          .update(stocktakeLines)
          .set({
            countedQuantity: newCountedQty.toString(),
            lastCountedBy: username,
            lastCountedAt: new Date(),
            notes: dto.notes !== undefined ? dto.notes : line.notes,
          })
          .where(eq(stocktakeLines.stocktakeLineId, lineId));
      } else {
        // Unlisted line added on the fly
        newCountedQty = countQty;
        const [newLine] = await tx
          .insert(stocktakeLines)
          .values({
            stocktakeId: id,
            productId: dto.productId,
            binId: dto.binId,
            expectedQuantity: '0',
            countedQuantity: newCountedQty.toString(),
            isUnlisted: true,
            notes: dto.notes || null,
            lastCountedBy: username,
            lastCountedAt: new Date(),
          })
          .returning();
        lineId = newLine.stocktakeLineId;
      }

      // Record immutable count event
      const [countEntry] = await tx
        .insert(stocktakeCounts)
        .values({
          stocktakeId: id,
          stocktakeLineId: lineId,
          productId: dto.productId,
          binId: dto.binId,
          quantity: dto.quantity,
          countMode: dto.countMode || 'set',
          countedBy: username,
          countedAt: new Date(),
          notes: dto.notes || null,
        })
        .returning();

      // Fetch product and bin info for event enrichment
      const [prod] = await tx
        .select({
          productNumber: products.productNumber,
          productName: products.name,
        })
        .from(products)
        .where(eq(products.productId, dto.productId))
        .limit(1);

      const [b] = await tx
        .select({ binNumber: bins.binNumber })
        .from(bins)
        .where(eq(bins.binId, dto.binId))
        .limit(1);

      // Emit event
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: id,
        eventType: EventType.COUNTED,
        entityDisplayName: existing.stocktakeNumber,
        payload: {
          countId: countEntry.stocktakeCountId,
          stocktakeLineId: lineId,
          productId: dto.productId,
          productNumber: prod?.productNumber,
          productName: prod?.productName,
          binId: dto.binId,
          binNumber: b?.binNumber,
          quantity: dto.quantity,
          newTotalCount: newCountedQty,
          countMode: dto.countMode || 'set',
          countedBy: username,
        },
        actor: username,
      });

      return {
        lineId,
        countedQuantity: newCountedQty.toString(),
        countEntry,
      };
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  async recordBatchCounts(
    id: string,
    dto: BatchRecordStocktakeCountsDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const results = [];
      for (const countDto of dto.counts) {
        const res = await this.recordCount(id, countDto, username, tx);
        results.push(res);
      }
      return { success: true, count: results.length, results };
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
  }

  async addUnlistedProduct(
    id: string,
    dto: AddStocktakeUnlistedProductDto,
    username: string,
    passedTx?:
      | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0]
      | DrizzleDB,
  ) {
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const res = await this.recordCount(
        id,
        {
          productId: dto.productId,
          binId: dto.binId,
          quantity: dto.countedQuantity,
          countMode: 'set',
          notes: dto.notes,
        },
        username,
        tx,
      );

      const [line] = await tx
        .select()
        .from(stocktakeLines)
        .where(eq(stocktakeLines.stocktakeLineId, res.lineId))
        .limit(1);

      return line;
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
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

      if (existing.stateCode !== STOCKTAKE_STATE.OPEN) {
        throw new BadRequestException(
          `Cannot record counts on stocktake in ${existing.stateCode} state. Stocktake must be open.`,
        );
      }

      const binLines = await tx
        .select()
        .from(stocktakeLines)
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            eq(stocktakeLines.binId, binId),
          ),
        );

      const results = [];
      for (const line of binLines) {
        const res = await this.recordCount(
          id,
          {
            productId: line.productId,
            binId: line.binId,
            quantity: '0',
            countMode: 'set',
            notes: notes || 'Marked empty',
          },
          username,
          tx,
        );
        results.push(res);
      }

      return {
        success: true,
        binId,
        markedCount: results.length,
        results,
      };
    };

    if (passedTx) {
      return execute(passedTx);
    }
    return this.db.transaction((tx) => execute(tx));
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
    const execute = async (
      tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    ) => {
      const [existingLine] = await tx
        .select({
          line: stocktakeLines,
          productNumber: products.productNumber,
          productName: products.name,
          binNumber: bins.binNumber,
        })
        .from(stocktakeLines)
        .innerJoin(products, eq(stocktakeLines.productId, products.productId))
        .innerJoin(bins, eq(stocktakeLines.binId, bins.binId))
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            eq(stocktakeLines.stocktakeLineId, lineId),
          ),
        )
        .limit(1);

      if (!existingLine) {
        throw new NotFoundException(`Stocktake line ${lineId} not found`);
      }

      const updateData: Partial<typeof stocktakeLines.$inferInsert> = {};
      if (dto.countedQuantity !== undefined) {
        updateData.countedQuantity = dto.countedQuantity;
        updateData.lastCountedBy = username;
        updateData.lastCountedAt = new Date();
      }
      if (dto.notes !== undefined) {
        updateData.notes = dto.notes;
      }

      const [updated] = await tx
        .update(stocktakeLines)
        .set(updateData)
        .where(eq(stocktakeLines.stocktakeLineId, lineId))
        .returning();

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: id,
        eventType: EventType.LINE_UPDATED,
        entityDisplayName: lineId,
        payload: {
          stocktakeLineId: lineId,
          productId: updated.productId,
          productNumber: existingLine.productNumber,
          productName: existingLine.productName,
          binId: updated.binId,
          binNumber: existingLine.binNumber,
          countedQuantity: updated.countedQuantity,
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

  async deleteLine(
    id: string,
    lineId: string,
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
          `Cannot delete lines on stocktake in ${existing.stateCode} state`,
        );
      }

      const [existingLine] = await tx
        .select({
          line: stocktakeLines,
          productNumber: products.productNumber,
          productName: products.name,
          binNumber: bins.binNumber,
        })
        .from(stocktakeLines)
        .innerJoin(products, eq(stocktakeLines.productId, products.productId))
        .innerJoin(bins, eq(stocktakeLines.binId, bins.binId))
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            eq(stocktakeLines.stocktakeLineId, lineId),
          ),
        )
        .limit(1);

      if (!existingLine) {
        throw new NotFoundException(`Stocktake line ${lineId} not found`);
      }

      await tx
        .delete(stocktakeLines)
        .where(
          and(
            eq(stocktakeLines.stocktakeId, id),
            eq(stocktakeLines.stocktakeLineId, lineId),
          ),
        );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.STOCKTAKE,
        entityId: id,
        eventType: EventType.LINE_REMOVED,
        entityDisplayName: lineId,
        payload: {
          lineId,
          productId: existingLine.line.productId,
          productNumber: existingLine.productNumber,
          productName: existingLine.productName,
          binId: existingLine.line.binId,
          binNumber: existingLine.binNumber,
        },
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
