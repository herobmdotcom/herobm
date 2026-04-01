import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { organization } from '../drizzle/modbm-core-schema';
import { UpdateOrganizationDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async get() {
    const rows = await this.db.select().from(organization).limit(1);
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

  async update(dto: UpdateOrganizationDto) {
    if (!dto.name) {
      throw new BadRequestException('Company name is required');
    }

    const rows = await this.db.select().from(organization).limit(1);

    if (rows.length === 0) {
      // Create the singleton record
      const newRows = await this.db
        .insert(organization)
        .values({
          ...dto,
        })
        .returning();
      return newRows[0];
    } else {
      // Update the existing singleton record
      const updatedRows = await this.db
        .update(organization)
        .set({
          ...dto,
        })
        .where(eq(organization.organizationId, rows[0].organizationId))
        .returning();
      return updatedRows[0];
    }
  }
}
