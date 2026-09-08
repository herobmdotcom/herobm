import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { users, userTwoFactor, userEvents } from '@herobm/db-schema';

describe('UsersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: UsersService;

  const user1Id = '00000000-0000-0000-0000-000000000001';
  const user2Id = '00000000-0000-0000-0000-000000000002';

  beforeEach(async () => {
    await pg.db.delete(userEvents);
    await pg.db.delete(userTwoFactor);
    await pg.db.delete(users);

    await pg.db.insert(users).values([
      {
        userId: user1Id,
        username: 'user_without_2fa',
        // eslint-disable-next-line no-restricted-syntax -- Mock password in test
        passwordHash: 'hash1',
        role: 'viewer',
        displayName: 'User One',
        email: 'user1@test.com',
        isActive: true,
      },
      {
        userId: user2Id,
        username: 'user_with_2fa',
        // eslint-disable-next-line no-restricted-syntax -- Mock password in test
        passwordHash: 'hash2',
        role: 'sales',
        displayName: 'User Two',
        email: 'user2@test.com',
        isActive: true,
      },
    ]);

    // Enable 2FA for user 2
    await pg.db.insert(userTwoFactor).values({
      userId: user2Id,
      // eslint-disable-next-line no-restricted-syntax -- Mock secret in test
      secretEncrypted: 'enc_secret',
      isEnabled: true,
      backupCodes: [],
      verifiedAt: new Date(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('findAll correctly populates twoFactorEnabled for all users', async () => {
    const list = await service.findAll();
    expect(list).toHaveLength(2);

    const u1 = list.find((u) => u.userId === user1Id);
    const u2 = list.find((u) => u.userId === user2Id);

    expect(u1).toBeDefined();
    expect(u1?.twoFactorEnabled).toBe(false);

    expect(u2).toBeDefined();
    expect(u2?.twoFactorEnabled).toBe(true);
  });

  it('findOne returns twoFactorEnabled: false when 2FA is disabled', async () => {
    const user = await service.findOne(user1Id);
    expect(user.twoFactorEnabled).toBe(false);
  });

  it('findOne returns twoFactorEnabled: true when 2FA is enabled', async () => {
    const user = await service.findOne(user2Id);
    expect(user.twoFactorEnabled).toBe(true);
  });

  it('create provisions user with twoFactorEnabled: false', async () => {
    const created = await service.create(
      {
        username: 'new_user',
        // eslint-disable-next-line no-restricted-syntax -- Mock password in test
        password: '<REDACTED>',
        role: 'viewer',
        displayName: 'New User',
      },
      'admin',
    );

    expect(created.twoFactorEnabled).toBe(false);
    expect(created.username).toBe('new_user');
  });

  it('update preserves twoFactorEnabled', async () => {
    const updated = await service.update(
      user2Id,
      { displayName: 'Updated Two' },
      '00000000-0000-0000-0000-000000000099',
      'admin',
    );

    expect(updated.displayName).toBe('Updated Two');
    expect(updated.twoFactorEnabled).toBe(true);
  });

  it('getEvents returns all user events ordered descending, including deleted users (ADV-191)', async () => {
    // 1. Create user
    const created = await service.create(
      {
        username: 'audit_target',
        // eslint-disable-next-line no-restricted-syntax -- Mock password in test
        password: '<REDACTED>',
        role: 'viewer',
        displayName: 'Audit Target',
      },
      'admin_actor',
    );

    // 2. Toggle active
    await service.toggleActive(
      created.userId,
      '00000000-0000-0000-0000-000000000099',
      'admin_actor',
    );

    // 3. Delete user
    await service.remove(
      created.userId,
      '00000000-0000-0000-0000-000000000099',
      'admin_actor',
    );

    // 4. Verify user is no longer in users table
    const activeList = await service.findAll();
    expect(activeList.find((u) => u.userId === created.userId)).toBeUndefined();

    // 5. Verify getEvents returns all 3 events (created, status_changed, deleted)
    const events = await service.getEvents();
    const userEventsList = events.filter((e) => e.userId === created.userId);
    expect(userEventsList).toHaveLength(3);

    // Verify descending order (most recent first)
    expect(userEventsList[0].eventType).toBe('deleted');
    expect(userEventsList[1].eventType).toBe('status_changed');
    expect(userEventsList[2].eventType).toBe('created');
    expect(userEventsList[0].entityDisplayName).toBe('audit_target');
  });
});
