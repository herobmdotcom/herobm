import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { suppliers } from '../drizzle/schema';
import { eq, ilike, or, and } from 'drizzle-orm';

export class SupplierSearchParams {
  q?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll(params: SupplierSearchParams) {
    const limit = params.limit ? Number(params.limit) : 50;
    const offset = params.offset ? Number(params.offset) : 0;
    
    let conditions = undefined;
    if (params.q) {
      const searchTerm = `%${params.q}%`;
      conditions = or(
        ilike(suppliers.name, searchTerm),
        ilike(suppliers.vendorNumber, searchTerm)
      );
    }

    const data = await this.db
      .select()
      .from(suppliers)
      .where(conditions)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    // Ideally use count(), but simple length if no conditions works for small sets,
    // For large sets, another query is needed.
    const [{ count }] = await this.db
      .select({ count: this.db.$count(suppliers, conditions) })
      .from(suppliers);

    return {
      data,
      total: Number(count),
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    const supplier = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.vendorId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }
}
