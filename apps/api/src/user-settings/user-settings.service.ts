import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { userSettings } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

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
    await this.getSettings(userId);

    const [updated] = await this.db
      .update(userSettings)
      .set({
        ...(data.dashboardConfig !== undefined && {
          dashboardConfig: data.dashboardConfig,
        }),
        ...(data.reportConfigs !== undefined && {
          reportConfigs: data.reportConfigs,
        }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences,
        }),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning();

    return updated;
  }
}
