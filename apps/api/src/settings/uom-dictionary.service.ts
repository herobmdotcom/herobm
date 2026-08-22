import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { uomDictionary, products, productUoms } from '@herobm/db-schema';
import { CreateUomDto, UpdateUomDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class UomDictionaryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(uomDictionary).orderBy(uomDictionary.uomCode);
  }

  async findOne(code: string) {
    const rows = await this.db
      .select()
      .from(uomDictionary)
      .where(eq(uomDictionary.uomCode, code))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`UOM code '${code}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateUomDto) {
    if (!dto.uomCode || !dto.description) {
      throw new BadRequestException('uomCode and description are required');
    }
    const rows = await this.db
      .insert(uomDictionary)
      .values({
        uomCode: dto.uomCode.toUpperCase().trim(),
        description: dto.description.trim(),
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: 'system',
      eventType: EventType.UPDATED,
      entityDisplayName: 'System UOM',
      payload: { uomCode: rows[0].uomCode },
      actor: 'system', // we could take actor in create() but no param exists currently
    });

    return rows[0];
  }

  async update(code: string, dto: UpdateUomDto) {
    const existing = await this.findOne(code);

    if (dto.description !== undefined) {
      dto.description = dto.description.trim();
    }

    const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

    if (audit.hasChanges) {
      const rows = await this.db
        .update(uomDictionary)
        .set({
          ...audit.changes,
        } as typeof uomDictionary.$inferInsert)
        .where(eq(uomDictionary.uomCode, code))
        .returning();

      await emitEvent(this.db, {
        entityType: EntityType.SYSTEM,
        entityId: 'system',
        eventType: EventType.UPDATED,
        entityDisplayName: 'System UOM',
        payload: {
          uomCode: rows[0].uomCode,
          changes: audit.changes,
          previous: audit.previousValues,
        },
        actor: 'system',
      });

      return rows[0];
    }

    return existing;
  }

  async delete(code: string) {
    await this.findOne(code);

    // Check for references in products (base_uom)
    const [prodDep] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.baseUom, code));

    if (Number(prodDep?.count) > 0) {
      throw new ConflictException(
        `Cannot delete UOM '${code}' because it is set as the base unit of measure on ${prodDep.count} product(s).`,
      );
    }

    // Check for references in product_uoms
    const [uomDep] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productUoms)
      .where(eq(productUoms.uomCode, code));

    if (Number(uomDep?.count) > 0) {
      throw new ConflictException(
        `Cannot delete UOM '${code}' because it is assigned as a unit conversion on ${uomDep.count} product(s).`,
      );
    }

    await this.db.delete(uomDictionary).where(eq(uomDictionary.uomCode, code));

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: 'system',
      eventType: EventType.UPDATED,
      entityDisplayName: 'System UOM',
      payload: { uomCode: code, action: 'deleted' },
      actor: 'system',
    });

    return { deleted: true };
  }
}
