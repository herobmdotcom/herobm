import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { userSettings } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { calculateAuditTrail, AuditMode } from '../common/audit';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class UserSettingsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getSettings(userId: string) {
    let settings = await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    if (!settings) {
      const [inserted] = await this.db
        .insert(userSettings)
        .values({
          userId,
          preferences: { density: 'comfortable', theme: 'dark' },
        })
        .returning();
      settings = inserted;

      await emitEvent(this.db, {
        entityType: EntityType.USER,
        entityId: userId,
        eventType: EventType.CREATED,
        entityDisplayName: `User Preferences (${userId})`,
        payload: { preferences: { density: 'comfortable', theme: 'dark' } },
        actor: userId,
      });
    } else if (!settings.preferences) {
      settings = {
        ...settings,
        preferences: { density: 'comfortable', theme: 'dark' },
      };
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    data: Partial<{
      dashboardConfig: Record<string, unknown>;
      reportConfigs: Record<string, unknown>;
      preferences: Record<string, unknown>;
    }>,
  ) {
    // Ensure record exists
    const existing = await this.getSettings(userId);

    const mergedData: typeof data = {};
    if (data.dashboardConfig !== undefined) {
      mergedData.dashboardConfig = {
        ...(existing.dashboardConfig || {}),
        ...data.dashboardConfig,
      };
    }
    if (data.reportConfigs !== undefined) {
      mergedData.reportConfigs = {
        ...(existing.reportConfigs || {}),
        ...data.reportConfigs,
      };
    }
    if (data.preferences !== undefined) {
      mergedData.preferences = {
        ...(existing.preferences || {}),
        ...data.preferences,
      };
    }

    const audit = calculateAuditTrail(mergedData, existing, AuditMode.DIFF);

    if (audit.hasChanges) {
      const [updated] = await this.db
        .update(userSettings)
        .set({
          ...audit.changes,
          updatedAt: new Date(),
        } as typeof userSettings.$inferInsert)
        .where(eq(userSettings.userId, userId))
        .returning();

      await emitEvent(this.db, {
        entityType: EntityType.USER,
        entityId: userId,
        eventType: EventType.UPDATED,
        entityDisplayName: `User Preferences (${userId})`,
        payload: { changes: Object.keys(audit.changes) },
        actor: userId,
      });

      return updated;
    }

    return existing;
  }
}
