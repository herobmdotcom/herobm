import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { organization } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { StorageService } from '../common/storage/storage.service';
import { UpdateOrganizationDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly storageService: StorageService,
  ) {}

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

  async uploadLogo(file: Express.Multer.File, actor: string) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (!allowed.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        'Invalid image format. Allowed: JPG, PNG, WebP, GIF, SVG',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image exceeds 5MB maximum size limit');
    }

    const currentOrg = await this.get();
    if (currentOrg.logoUrl) {
      await this.storageService.deleteFile(currentOrg.logoUrl);
    }

    const saved = await this.storageService.saveImage('organization', file);

    const rows = await this.db.select().from(organization).limit(1);
    let result;
    if (rows.length === 0) {
      const [inserted] = await this.db
        .insert(organization)
        .values({
          name: 'My Company',
          logoUrl: saved.storagePath,
        })
        .returning();
      result = inserted;
    } else {
      const [updated] = await this.db
        .update(organization)
        .set({
          logoUrl: saved.storagePath,
        })
        .where(eq(organization.organizationId, rows[0].organizationId))
        .returning();
      result = updated;
    }

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: result.organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization Settings',
      payload: { action: 'logo_uploaded', logoUrl: saved.storagePath },
      actor,
    });

    return result;
  }

  async removeLogo(actor: string) {
    const currentOrg = await this.get();
    if (currentOrg.logoUrl) {
      await this.storageService.deleteFile(currentOrg.logoUrl);
    }

    const rows = await this.db.select().from(organization).limit(1);
    if (rows.length === 0) {
      return currentOrg;
    }

    const [updated] = await this.db
      .update(organization)
      .set({
        logoUrl: '',
      })
      .where(eq(organization.organizationId, rows[0].organizationId))
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: updated.organizationId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Organization Settings',
      payload: { action: 'logo_removed' },
      actor,
    });

    return updated;
  }
}
