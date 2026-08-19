import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { eq, ne, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { taxCategories, appSettings } from '@herobm/db-schema';
import { CreateTaxCategoryDto, UpdateTaxCategoryDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class TaxCategoriesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(taxCategories);
  }

  async getById(id: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid tax category ID: ${id}`);
    }

    const rows = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.taxCategoryId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Tax category '${id}' not found`);
    }
    return rows[0];
  }

  async getDefaultSalesTax(tx?: DrizzleDB) {
    const db = tx || this.db;

    const defaultSettings = await db
      .select({ taxCategoryId: appSettings.defaultSalesTaxCategoryId })
      .from(appSettings)
      .limit(1);

    if (defaultSettings.length > 0 && defaultSettings[0].taxCategoryId) {
      const rows = await db
        .select()
        .from(taxCategories)
        .where(
          eq(taxCategories.taxCategoryId, defaultSettings[0].taxCategoryId),
        )
        .limit(1);

      if (rows.length > 0) {
        return rows[0];
      }
    }

    throw new NotFoundException('No default sales tax category configured');
  }

  async getByCode(code: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.code, code))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`Tax category code '${code}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateTaxCategoryDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(taxCategories)
        .values({
          code: dto.code,
          title: dto.title,
          type: dto.type,
          rate: dto.rate ?? '0',
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.TAX_CATEGORY,
        entityId: rows[0].taxCategoryId,
        eventType: EventType.CREATED,
        entityDisplayName: rows[0].code,
        payload: dto,
        actor: userId,
      });

      return rows[0];
    });
  }

  async update(id: string, dto: UpdateTaxCategoryDto, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const existing = await this.getById(id, tx); // ensure exists

      const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

      if (audit.hasChanges) {
        const rows = await tx
          .update(taxCategories)
          .set({ ...audit.changes } as typeof taxCategories.$inferInsert)
          .where(eq(taxCategories.taxCategoryId, id))
          .returning();

        await emitEvent(tx, {
          entityType: EntityType.TAX_CATEGORY,
          entityId: rows[0].taxCategoryId,
          eventType: EventType.UPDATED,
          entityDisplayName: rows[0].code,
          payload: {
            changes: audit.changes,
            previous: audit.previousValues,
          },
          actor: userId,
        });

        return rows[0];
      }
      return existing;
    });
  }

  async delete(id: string, userId?: string) {
    return await this.db.transaction(async (tx) => {
      const cat = await this.getById(id, tx);

      await tx.delete(taxCategories).where(eq(taxCategories.taxCategoryId, id));

      await emitEvent(tx, {
        entityType: EntityType.TAX_CATEGORY,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: cat.code,
        payload: {},
        actor: userId,
      });

      return { deleted: true };
    });
  }
}
