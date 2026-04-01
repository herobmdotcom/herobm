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
import { gstCategories } from '../drizzle/modbm-core-schema';
import { CreateGstCategoryDto, UpdateGstCategoryDto } from './dto';

@Injectable()
export class GstCategoriesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(gstCategories);
  }

  async getById(id: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      throw new NotFoundException(`Invalid GST category ID: ${id}`);
    }

    const rows = await this.db
      .select()
      .from(gstCategories)
      .where(eq(gstCategories.gstCategoryId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`GST category '${id}' not found`);
    }
    return rows[0];
  }

  async getDefault() {
    const rows = await this.db
      .select()
      .from(gstCategories)
      .where(eq(gstCategories.isDefault, true))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException('No default GST category configured');
    }
    return rows[0];
  }

  async getByCode(code: string) {
    const rows = await this.db
      .select()
      .from(gstCategories)
      .where(eq(gstCategories.code, code))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`GST category code '${code}' not found`);
    }
    return rows[0];
  }

  async create(dto: CreateGstCategoryDto) {
    // If the new category wants to be default, unset any existing default first
    if (dto.isDefault) {
      await this.db
        .update(gstCategories)
        .set({ isDefault: false })
        .where(eq(gstCategories.isDefault, true));
    }

    const rows = await this.db
      .insert(gstCategories)
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

  async update(id: string, dto: UpdateGstCategoryDto) {
    await this.getById(id); // ensure exists

    // If toggling isDefault to true, unset the current default
    if (dto.isDefault === true) {
      await this.db
        .update(gstCategories)
        .set({ isDefault: false })
        .where(
          and(
            eq(gstCategories.isDefault, true),
            ne(gstCategories.gstCategoryId, id),
          ),
        );
    }

    const rows = await this.db
      .update(gstCategories)
      .set({
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      })
      .where(eq(gstCategories.gstCategoryId, id))
      .returning();

    return rows[0];
  }

  async delete(id: string) {
    const cat = await this.getById(id);

    if (cat.isDefault) {
      throw new BadRequestException(
        'Cannot delete the default GST category. Assign a different default first.',
      );
    }

    try {
      await this.db
        .delete(gstCategories)
        .where(eq(gstCategories.gstCategoryId, id));
      return { deleted: true };
    } catch (err: any) {
      // Postgres foreign_key_violation
      if (err?.code === '23503') {
        throw new BadRequestException(
          'Cannot delete this GST category because it is assigned to one or more accounts or products. Remove the assignments first.',
        );
      }
      throw err;
    }
  }
}
