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
import { taxCategories } from '../drizzle/modbm-core-schema';
import { CreateTaxCategoryDto, UpdateTaxCategoryDto } from './dto';

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

  async getDefault(tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.isDefault, true))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('No default tax category configured');
    }
    return rows[0];
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

  async create(dto: CreateTaxCategoryDto) {
    // If the new category wants to be default, unset any existing default first
    if (dto.isDefault) {
      await this.db
        .update(taxCategories)
        .set({ isDefault: false })
        .where(eq(taxCategories.isDefault, true));
    }

    const rows = await this.db
      .insert(taxCategories)
      .values({
        code: dto.code,
        title: dto.title,
        type: dto.type,
        rate: dto.rate ?? '0',
        isDefault: dto.isDefault ?? false,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateTaxCategoryDto) {
    await this.getById(id); // ensure exists

    // If toggling isDefault to true, unset the current default
    if (dto.isDefault === true) {
      await this.db
        .update(taxCategories)
        .set({ isDefault: false })
        .where(
          and(
            eq(taxCategories.isDefault, true),
            ne(taxCategories.taxCategoryId, id),
          ),
        );
    }

    const rows = await this.db
      .update(taxCategories)
      .set({
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      })
      .where(eq(taxCategories.taxCategoryId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    const cat = await this.getById(id);

    if (cat.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default tax category. Assign a different default first.',
      );
    }

    try {
      await this.db
        .delete(taxCategories)
        .where(eq(taxCategories.taxCategoryId, id));
      return { deleted: true };
    } catch (err: unknown) {
      // Postgres foreign_key_violation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === '23503') {
        throw new BadRequestException(
          'Cannot delete this tax category because it is assigned to one or more customers or products. Remove the assignments first.',
        );
      }
      throw err;
    }
  }
}
