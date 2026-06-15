import {
  locations,
  zones,
  bins,
  appSettings,
  users,
} from '../../src/drizzle/herobm-core-schema';
import * as bcrypt from 'bcrypt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedTestLocations(db: any, dryRun = false) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed test location: MAIN');
    return;
  }

  await db
    .insert(locations)
    .values({
      locationId: '10000000-0000-0000-0000-000000000001',
      code: 'MAIN',
      name: 'Main Location',
    })
    .onConflictDoUpdate({
      target: locations.locationId,
      set: { code: 'MAIN', name: 'Main Location' },
    });

  await db
    .insert(zones)
    .values({
      zoneId: '30000000-0000-0000-0000-000000000001',
      locationId: '10000000-0000-0000-0000-000000000001',
      code: 'MAIN-Z1',
      name: 'Main Zone',
    })
    .onConflictDoUpdate({
      target: zones.zoneId,
      set: { code: 'MAIN-Z1', name: 'Main Zone' },
    });

  await db
    .insert(bins)
    .values([
      {
        binId: '40000000-0000-0000-0000-000000000001',
        zoneId: '30000000-0000-0000-0000-000000000001',
        binNumber: 'RECEIVING',
        binType: 'staging',
        source: 'system',
        isUnavailable: true,
      },
      {
        binId: '40000000-0000-0000-0000-000000000002',
        zoneId: '30000000-0000-0000-0000-000000000001',
        binNumber: 'SHIPPING',
        binType: 'staging',
        source: 'system',
        isUnavailable: true,
      },
      {
        binId: '40000000-0000-0000-0000-000000000003',
        zoneId: '30000000-0000-0000-0000-000000000001',
        binNumber: 'MAIN-BIN-1',
        binType: 'storage',
        source: 'app',
        isUnavailable: false,
      },
    ])
    .onConflictDoUpdate({
      target: bins.binId,
      set: { binNumber: 'RECEIVING', binType: 'staging' },
    });

  await db.update(appSettings).set({
    defaultFulfillmentLocationId: '10000000-0000-0000-0000-000000000001',
  });

  console.log("  Seeded test 'MAIN' location, zone, and bins");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedTestUsers(db: any, dryRun = false) {
  if (dryRun) {
    console.log('  [DRY RUN] Would seed test users: viewer, sales, finance, warehouse, procurement, system, restricted_user');
    return;
  }

  const viewerPass = process.env.DEV_VIEWER_PASSWORD || 'password'; // TEST_CREDENTIAL
  const viewerHash = await bcrypt.hash(viewerPass, 10);
  const salesHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL

  await db
    .insert(users)
    .values({
      username: 'viewer',
      passwordHash: viewerHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'viewer' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: { passwordHash: viewerHash, role: 'viewer' as any, isActive: true },
    });

  await db
    .insert(users)
    .values({
      username: 'sales',
      passwordHash: salesHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'sales' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: { passwordHash: salesHash, role: 'sales' as any, isActive: true },
    });

  const financeHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'finance',
      passwordHash: financeHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'finance' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: financeHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'finance' as any,
        isActive: true,
      },
    });

  const warehouseHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'warehouse',
      passwordHash: warehouseHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'warehouse' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: warehouseHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'warehouse' as any,
        isActive: true,
      },
    });

  const procurementHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'procurement',
      passwordHash: procurementHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'procurement' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: procurementHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'procurement' as any,
        isActive: true,
      },
    });

  const systemHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'system',
      passwordHash: systemHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'system' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: { passwordHash: systemHash, role: 'system' as any, isActive: true },
    });

  const restrictedHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'restricted_user',
      passwordHash: restrictedHash,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: 'restricted_user' as any,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: restrictedHash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'restricted_user' as any,
        isActive: true,
      },
    });

  console.log(
    '  [E2E] Seeded test users: viewer, sales, finance, warehouse, procurement, system, restricted_user',
  );
}
