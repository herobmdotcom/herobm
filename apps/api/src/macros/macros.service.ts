import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../drizzle/drizzle.module';
import * as schema from '../drizzle/modbm-core-schema';
import { CreateMacroDto } from './dto/create-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';

@Injectable()
export class MacrosService {
  constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) {}

  async findAll(macroType?: string) {
    if (macroType) {
      return this.db.query.macros.findMany({
        where: eq(schema.macros.macroType, macroType),
        orderBy: (macros, { asc }) => [asc(macros.name)],
      });
    }
    return this.db.query.macros.findMany({
      orderBy: (macros, { asc }) => [asc(macros.name)],
    });
  }

  async findOne(macroId: string) {
    const macro = await this.db.query.macros.findFirst({
      where: eq(schema.macros.macroId, macroId),
    });
    if (!macro) {
      throw new NotFoundException(`Macro with ID ${macroId} not found`);
    }
    return macro;
  }

  async create(createMacroDto: CreateMacroDto) {
    const [macro] = await this.db
      .insert(schema.macros)
      .values({
        ...createMacroDto,
      })
      .returning();
    return macro;
  }

  async update(macroId: string, updateMacroDto: UpdateMacroDto) {
    const macro = await this.findOne(macroId);
    if (!macro) {
      throw new NotFoundException(`Macro with ID ${macroId} not found`);
    }

    const [updated] = await this.db
      .update(schema.macros)
      .set({
        ...updateMacroDto,
        modifiedOn: new Date(),
      })
      .where(eq(schema.macros.macroId, macroId))
      .returning();

    return updated;
  }

  async remove(macroId: string) {
    const macro = await this.findOne(macroId);
    if (!macro) {
      throw new NotFoundException(`Macro with ID ${macroId} not found`);
    }

    const [deleted] = await this.db
      .delete(schema.macros)
      .where(eq(schema.macros.macroId, macroId))
      .returning();

    return deleted;
  }
}
