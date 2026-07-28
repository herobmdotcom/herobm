import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { userSettings } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { calculateAuditTrail, AuditMode } from '../common/audit';

@Injectable()
export class UserSettingsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async getSettings(userId: string) {
    let settings = await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    if (!settings) {
      const [inserted] = await this.db
        // @herobm-skip-audit
        .insert(userSettings)
        .values({ userId })
        .returning();
      settings = inserted;
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

    const audit = calculateAuditTrail(data, existing, AuditMode.DIFF);

    if (audit.hasChanges) {
      const [updated] = await this.db
        // @herobm-skip-audit
        .update(userSettings)
        .set({
          ...audit.changes,
          updatedAt: new Date(),
        } as typeof userSettings.$inferInsert)
        .where(eq(userSettings.userId, userId))
        .returning();

      return updated;
    }

    return existing;
  }
}
