import { Test, TestingModule } from '@nestjs/testing';
import { UserSettingsService } from './user-settings.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { userSettings, users } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';

describe('UserSettingsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: UserSettingsService;
  const mockUserId = '00000000-0000-0000-0000-000000000099';

  beforeEach(async () => {
    await pg.db.delete(userSettings);
    await pg.db.delete(users);

    await pg.db
      .insert(users)
      .values({
        userId: mockUserId,
        username: 'test_settings_user',
        // eslint-disable-next-line no-restricted-syntax -- Mock password in test
        passwordHash: 'hash',
        role: 'admin',
        displayName: 'Settings Test User',
        email: 'settings@test.com',
        isActive: true,
      })
      .onConflictDoNothing();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSettingsService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<UserSettingsService>(UserSettingsService);
  });

  it('creates and returns default settings when record does not exist', async () => {
    const settings = await service.getSettings(mockUserId);
    expect(settings).toBeDefined();
    expect(settings.userId).toBe(mockUserId);
    expect(settings.preferences).toEqual({ density: 'comfortable' });
    expect(settings.createdAt).toBeDefined();
  });

  it('partially updates preferences without overwriting other preferences or config', async () => {
    // Initial insert
    await service.updateSettings(mockUserId, {
      dashboardConfig: { pinned: ['report-1'] },
      preferences: {
        density: 'comfortable',
        defaultLandingPage: '/sales-orders',
      },
    });

    // Update only density
    const updated = await service.updateSettings(mockUserId, {
      preferences: { density: 'compact' },
    });

    expect(updated.preferences).toEqual({
      density: 'compact',
      defaultLandingPage: '/sales-orders',
    });
    expect(updated.dashboardConfig).toEqual({
      pinned: ['report-1'],
    });

    // Verify persisted in DB
    const persisted = await pg.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, mockUserId),
    });
    expect(persisted?.preferences).toEqual({
      density: 'compact',
      defaultLandingPage: '/sales-orders',
    });
  });
});
