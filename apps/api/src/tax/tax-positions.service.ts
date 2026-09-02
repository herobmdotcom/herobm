import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, ne, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { taxPositions, taxPositionMappings } from '@herobm/db-schema';
import {
  CreateTaxPositionDto,
  UpdateTaxPositionDto,
} from './tax-positions.dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class TaxPositionsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(taxPositions);
  }

  async getById(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid tax position ID: ${id}`);
    }

    const rows = await db
      .select()
      .from(taxPositions)
      .where(eq(taxPositions.taxPositionId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Tax position '${id}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateTaxPositionDto) {
    // Check if code exists
    const existing = await this.db
      .select()
      .from(taxPositions)
      .where(eq(taxPositions.code, dto.code));
    if (existing.length > 0) {
      throw new BadRequestException(
        `Tax position code '${dto.code}' already exists`,
      );
    }

    const inserted = await this.db
      .insert(taxPositions)
      .values({
        code: dto.code,
        title: dto.title,
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.TAX_POSITION,
      eventType: EventType.CREATED,
      entityId: inserted[0].taxPositionId,
      entityDisplayName: inserted[0].title,
      payload: inserted[0],
    });

    return inserted[0];
  }

  async update(id: string, dto: UpdateTaxPositionDto) {
    const existingPosition = await this.getById(id);

    // Code uniqueness check
    if (dto.code && dto.code !== existingPosition.code) {
      const existingCode = await this.db
        .select()
        .from(taxPositions)
        .where(eq(taxPositions.code, dto.code));
      if (existingCode.length > 0) {
        throw new BadRequestException(
          `Tax position code '${dto.code}' already exists`,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.title !== undefined) updateData.title = dto.title;

    if (Object.keys(updateData).length === 0) {
      return existingPosition;
    }

    const updated = await this.db
      .update(taxPositions)
      .set(updateData)
      .where(eq(taxPositions.taxPositionId, id))
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.TAX_POSITION,
      eventType: EventType.UPDATED,
      entityId: updated[0].taxPositionId,
      entityDisplayName: updated[0].title,
      payload: updated[0],
    });

    return updated[0];
  }

  async remove(id: string) {
    const deleted = await this.db
      .delete(taxPositions)
      .where(eq(taxPositions.taxPositionId, id))
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundException(`Tax position with ID ${id} not found`);
    }

    await emitEvent(this.db, {
      entityType: EntityType.TAX_POSITION,
      eventType: EventType.DELETED,
      entityId: deleted[0].taxPositionId,
      entityDisplayName: deleted[0].title,
      payload: deleted[0],
    });

    return deleted[0];
  }

  async findMappings() {
    return this.db.select().from(taxPositionMappings);
  }

  async createMapping(
    id: string,
    dto: { sourceTaxCategoryId: string; destinationTaxCategoryId: string },
  ) {
    await this.getById(id); // Ensure position exists

    // Check if mapping exists
    const existing = await this.db
      .select()
      .from(taxPositionMappings)
      .where(
        and(
          eq(taxPositionMappings.taxPositionId, id),
          eq(taxPositionMappings.sourceTaxCategoryId, dto.sourceTaxCategoryId),
        ),
      );

    if (existing.length > 0) {
      throw new BadRequestException(
        'Mapping already exists for this source category',
      );
    }

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(taxPositionMappings)
        .values({
          taxPositionId: id,
          sourceTaxCategoryId: dto.sourceTaxCategoryId,
          destinationTaxCategoryId: dto.destinationTaxCategoryId,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.TAX_POSITION_MAPPING,
        eventType: EventType.CREATED,
        entityId: inserted[0].mappingId,
        payload: inserted[0],
        entityDisplayName: `Mapped source category ${dto.sourceTaxCategoryId} to destination ${dto.destinationTaxCategoryId}`,
      });

      return inserted[0];
    });
  }

  async removeMapping(id: string, sourceTaxCategoryId: string) {
    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(taxPositionMappings)
        .where(
          and(
            eq(taxPositionMappings.taxPositionId, id),
            eq(taxPositionMappings.sourceTaxCategoryId, sourceTaxCategoryId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        throw new NotFoundException('Mapping not found');
      }

      await emitEvent(tx, {
        entityType: EntityType.TAX_POSITION_MAPPING,
        eventType: EventType.DELETED,
        entityId: deleted[0].mappingId,
        payload: deleted[0],
        entityDisplayName: `Removed mapping for source category ${sourceTaxCategoryId}`,
      });

      return deleted[0];
    });
  }
}
