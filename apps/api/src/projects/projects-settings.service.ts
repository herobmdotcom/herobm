import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { projectSettings } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ProjectsSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getSettings(tx?: DrizzleDB) {
    const db = tx || this.db;
    const [settings] = await db.select().from(projectSettings).limit(1);
    return settings || { projectMetadataSchema: null };
  }

  async updateSettings(
    data: { projectMetadataSchema?: Record<string, unknown> | null },
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [existing] = await db.select().from(projectSettings).limit(1);

    if (!existing) {
      const [created] = await db
        .insert(projectSettings)
        .values({
          projectMetadataSchema: data.projectMetadataSchema ?? null,
        })
        .returning();

      await emitEvent(db, {
        entityType: EntityType.PROJECT_SETTINGS,
        entityId: created.settingsId,
        entityDisplayName: 'Project Settings',
        eventType: EventType.UPDATED,
        payload: { changes: data },
        actor: 'system',
      });

      return created;
    }

    const [updated] = await db
      .update(projectSettings)
      .set({
        projectMetadataSchema:
          data.projectMetadataSchema !== undefined
            ? data.projectMetadataSchema
            : existing.projectMetadataSchema,
        modifiedOn: new Date(),
      })
      .where(eq(projectSettings.settingsId, existing.settingsId))
      .returning();

    await emitEvent(db, {
      entityType: EntityType.PROJECT_SETTINGS,
      entityId: existing.settingsId,
      entityDisplayName: 'Project Settings',
      eventType: EventType.UPDATED,
      payload: { changes: data },
      actor: 'system',
    });

    return updated;
  }
}
