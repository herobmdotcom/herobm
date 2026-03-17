import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { gstCategories } from '../drizzle/modbm-core-schema';

@Injectable()
export class GstCategoriesService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    return this.db.select().from(gstCategories);
  }

  async getById(id: string) {
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
}
