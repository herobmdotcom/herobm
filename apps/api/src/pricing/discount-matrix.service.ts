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
import { discountMatrix } from '../drizzle/modbm-core-schema';
import { CreateDiscountMatrixDto, UpdateDiscountMatrixDto } from './dto';
import type { DiscountRule } from '@modbm/shared';

@Injectable()
export class DiscountMatrixService {
  private readonly logger = new Logger(DiscountMatrixService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * List all discount rules for a given account group.
   */
  async findByAccountGroup(accountGroupId: string) {
    return this.db
      .select()
      .from(discountMatrix)
      .where(eq(discountMatrix.accountGroupId, accountGroupId));
  }

  /**
   * List all discount rules for a given account.
   */
  async findByAccount(accountId: string) {
    return this.db
      .select()
      .from(discountMatrix)
      .where(eq(discountMatrix.accountId, accountId));
  }

  async findAllAccountGroupRules() {
    return this.db
      .select()
      .from(discountMatrix)
      .where(isNull(discountMatrix.accountId));
  }

  async findAllAccountRules() {
    return this.db
      .select()
      .from(discountMatrix)
      .where(isNull(discountMatrix.accountGroupId));
  }

  async findAll() {
    return this.db.select().from(discountMatrix);
  }

  /**
   * Get all discount rules relevant to a specific account, including
   * the account's own rules AND its account group's rules.
   * Returns DiscountRule[] tagged with ownerType for the shared pricing function.
   */
  async resolveRulesForAccount(
    accountId: string,
    accountGroupId: string | null,
    tx?: DrizzleDB,
  ): Promise<DiscountRule[]> {
    const db = tx || this.db;
    const conditions = [eq(discountMatrix.accountId, accountId)];
    if (accountGroupId) {
      conditions.push(eq(discountMatrix.accountGroupId, accountGroupId));
    }

    const rows = await db
      .select()
      .from(discountMatrix)
      .where(or(...conditions));

    return rows.map((r) => ({
      ownerType: r.accountId ? 'account' : 'account_group',
      productGroupId: r.productGroupId,
      discountPercentage: r.discountPercentage,
    }));
  }

  /**
   * Create a new discount rule.
   */
  async create(dto: CreateDiscountMatrixDto) {
    // Validate exactly one owner
    if (dto.accountGroupId && dto.accountId) {
      throw new BadRequestException(
        'Exactly one of accountGroupId or accountId must be provided.',
      );
    }
    if (!dto.accountGroupId && !dto.accountId) {
      throw new BadRequestException(
        'Either accountGroupId or accountId must be provided.',
      );
    }

    const rows = await this.db
      .insert(discountMatrix)
      .values({
        accountGroupId: dto.accountGroupId || null,
        accountId: dto.accountId || null,
        productGroupId: dto.productGroupId || null,
        discountPercentage: dto.discountPercentage,
      })
      .returning();

    this.logger.log(
      `Discount rule created: ${rows[0].discountMatrixId} → ${dto.discountPercentage}%`,
    );
    return rows[0];
  }

  /**
   * Update a discount rule's percentage.
   */
  async update(id: string, dto: UpdateDiscountMatrixDto) {
    const existing = await this.findOne(id);

    const rows = await this.db
      .update(discountMatrix)
      .set({
        ...(dto.discountPercentage !== undefined && {
          discountPercentage: dto.discountPercentage,
        }),
        modifiedOn: new Date(),
      })
      .where(eq(discountMatrix.discountMatrixId, id))
      .returning();

    return rows[0];
  }

  /**
   * Delete a discount rule.
   */
  async delete(id: string) {
    await this.findOne(id);
    await this.db
      .delete(discountMatrix)
      .where(eq(discountMatrix.discountMatrixId, id));
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
