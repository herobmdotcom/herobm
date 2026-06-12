import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { organization } from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { UpdateOrganizationDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async get(tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db.select().from(organization).limit(1);
    if (rows.length === 0) {
      // Return a default object if no record exists yet
      return {
        name: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        country: '',
        postCode: '',
        email: '',
        phone: '',
        website: '',
        companyNumber: '',
        taxNumber: '',
        logoUrl: '',
        bankName: '',
        bankAccountName: '',
        bankAccountNumber: '',
        bankSwiftBic: '',
        bankIban: '',
      };
    }
    return rows[0];
  }

  async update(dto: UpdateOrganizationDto, actor: string) {
    if (!dto.name) {
      throw new BadRequestException('Company name is required');
    }

    const rows = await this.db.select().from(organization).limit(1);

    let result;
    if (rows.length === 0) {
      // Create the singleton record
      const newRows = await this.db
        .insert(organization)
        .values({
          ...dto,
        })
        .returning();
      result = newRows[0];
    } else {
      // Update the existing singleton record
      const updatedRows = await this.db
        .update(organization)
        .set({
          ...dto,
        })
        .where(eq(organization.organizationId, rows[0].organizationId))
        .returning();
      result = updatedRows[0];
    }

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: result.organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization Settings',
      payload: { changes: Object.keys(dto) },
      actor,
    });

    return result;
  }
}
