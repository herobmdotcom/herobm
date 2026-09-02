import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, or, and, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { discountMatrix } from '@herobm/db-schema';
import { CreateDiscountMatrixDto, UpdateDiscountMatrixDto } from './dto';
import type { DiscountRule } from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class DiscountMatrixService {
  private readonly logger = new Logger(DiscountMatrixService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * List all discount rules for a given customer group.
   */
  async findByAccountGroup(customerGroupId: string) {
    return this.db
      .select()
      .from(discountMatrix)
      .where(eq(discountMatrix.customerGroupId, customerGroupId));
  }

  /**
   * List all discount rules for a given customer.
   */
  async findByAccount(customerId: string) {
    return this.db
      .select()
      .from(discountMatrix)
      .where(eq(discountMatrix.customerId, customerId));
  }

  async findAllAccountGroupRules() {
    return this.db
      .select()
      .from(discountMatrix)
      .where(isNull(discountMatrix.customerId));
  }

  async findAllAccountRules() {
    return this.db
      .select()
      .from(discountMatrix)
      .where(isNull(discountMatrix.customerGroupId));
  }

  async findAll() {
    return this.db.select().from(discountMatrix);
  }

  /**
   * Get all discount rules relevant to a specific customer, including
   * the customer's own rules AND its customer group's rules.
   * Returns DiscountRule[] tagged with ownerType for the shared pricing function.
   */
  async resolveRulesForAccount(
    customerId: string,
    customerGroupId: string | null,
    tx?: DrizzleDB,
  ): Promise<DiscountRule[]> {
    const db = tx || this.db;
    const conditions = [eq(discountMatrix.customerId, customerId)];
    if (customerGroupId) {
      conditions.push(eq(discountMatrix.customerGroupId, customerGroupId));
    }

    const rows = await db
      .select()
      .from(discountMatrix)
      .where(or(...conditions));

    return rows.map((r) => ({
      ownerType: r.customerId ? 'customer' : 'customer_group',
      productGroupId: r.productGroupId,
      discountPercentage: r.discountPercentage,
    }));
  }

  /**
   * Create a new discount rule.
   */
  async create(dto: CreateDiscountMatrixDto) {
    // Validate exactly one owner
    if (dto.customerGroupId && dto.customerId) {
      throw new BadRequestException(
        'Exactly one of customerGroupId or customerId must be provided.',
      );
    }
    if (!dto.customerGroupId && !dto.customerId) {
      throw new BadRequestException(
        'Either customerGroupId or customerId must be provided.',
      );
    }

    const discount = parseFloat(dto.discountPercentage);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      throw new BadRequestException(
        'Discount percentage must be between 0 and 100.',
      );
    }

    const rows = await this.db
      .insert(discountMatrix)
      .values({
        customerGroupId: dto.customerGroupId || null,
        customerId: dto.customerId || null,
        productGroupId: dto.productGroupId || null,
        discountPercentage: dto.discountPercentage,
      })
      .returning();

    const entityType = dto.customerId
      ? EntityType.CUSTOMER
      : EntityType.CUSTOMER_GROUP;
    const entityId = dto.customerId || dto.customerGroupId!;

    // @sync-ignore
    await emitEvent(this.db, {
      entityType,
      entityId,
      eventType: EventType.UPDATED,
      entityDisplayName: dto.customerId ? 'Customer' : 'Customer Group',
      payload: {
        action: 'discount_rule_created',
        ruleId: rows[0].discountMatrixId,
      },
      actor: 'system',
    });

    this.logger.log(
      `Discount rule created: ${rows[0].discountMatrixId} → ${dto.discountPercentage}%`,
    );
    return rows[0];
  }

  /**
   * Update a discount rule's percentage.
   */
  async update(id: string, dto: UpdateDiscountMatrixDto) {
    if (dto.discountPercentage !== undefined) {
      const discount = parseFloat(dto.discountPercentage);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        throw new BadRequestException(
          'Discount percentage must be between 0 and 100.',
        );
      }
    }

    const existing = await this.findOne(id);

    const audit = calculateAuditTrail(dto, existing, AuditMode.DIFF);

    if (audit.hasChanges) {
      const rows = await this.db
        .update(discountMatrix)
        .set({
          ...audit.changes,
          modifiedOn: new Date(),
        } as typeof discountMatrix.$inferInsert)
        .where(eq(discountMatrix.discountMatrixId, id))
        .returning();

      const entityType = existing.customerId
        ? EntityType.CUSTOMER
        : EntityType.CUSTOMER_GROUP;
      const entityId = existing.customerId || existing.customerGroupId!;

      // @sync-ignore
      await emitEvent(this.db, {
        entityType,
        entityId,
        eventType: EventType.UPDATED,
        entityDisplayName: existing.customerId ? 'Customer' : 'Customer Group',
        payload: {
          action: 'discount_rule_updated',
          ruleId: id,
          changes: audit.changes,
          previous: audit.previousValues,
        },
        actor: 'system',
      });

      return rows[0];
    }
    return existing;
  }

  /**
   * Delete a discount rule.
   */
  async delete(id: string) {
    const existing = await this.findOne(id);
    await this.db
      .delete(discountMatrix)
      .where(eq(discountMatrix.discountMatrixId, id));

    const entityType = existing.customerId
      ? EntityType.CUSTOMER
      : EntityType.CUSTOMER_GROUP;
    const entityId = existing.customerId || existing.customerGroupId!;

    // @sync-ignore
    await emitEvent(this.db, {
      entityType,
      entityId,
      eventType: EventType.UPDATED,
      entityDisplayName: existing.customerId ? 'Customer' : 'Customer Group',
      payload: { action: 'discount_rule_deleted', ruleId: id },
      actor: 'system',
    });

    return { deleted: true };
  }

  /**
   * Get a single rule by ID.
   */
  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(discountMatrix)
      .where(eq(discountMatrix.discountMatrixId, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Discount rule '${id}' not found`);
    }
    return rows[0];
  }
}
