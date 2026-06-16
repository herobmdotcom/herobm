import {
  locations,
  zones,
  bins,
  appSettings,
  users,
} from '../../src/drizzle/herobm-core-schema';
import * as bcrypt from 'bcrypt';
import { SeedDB } from '../../src/scripts/seed';

export async function seedTestLocations(db: SeedDB, dryRun = false) {
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

export async function seedTestUsers(db: SeedDB, dryRun = false) {
  if (dryRun) {
    console.log(
      '  [DRY RUN] Would seed test users: viewer, sales, finance, warehouse, procurement, system, restricted_user',
    );
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
      role: 'viewer',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { passwordHash: viewerHash, role: 'viewer', isActive: true },
    });

  await db
    .insert(users)
    .values({
      username: 'sales',
      passwordHash: salesHash,
      role: 'sales',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { passwordHash: salesHash, role: 'sales', isActive: true },
    });

  const financeHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'finance',
      passwordHash: financeHash,
      role: 'finance',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: financeHash,
        role: 'finance',
        isActive: true,
      },
    });

  const warehouseHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'warehouse',
      passwordHash: warehouseHash,
      role: 'warehouse',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: warehouseHash,
        role: 'warehouse',
        isActive: true,
      },
    });

  const procurementHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'procurement',
      passwordHash: procurementHash,
      role: 'procurement',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: procurementHash,
        role: 'procurement',
        isActive: true,
      },
    });

  const systemHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'system',
      passwordHash: systemHash,
      role: 'system',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { passwordHash: systemHash, role: 'system', isActive: true },
    });

  const restrictedHash = await bcrypt.hash('password', 10); // TEST_CREDENTIAL
  await db
    .insert(users)
    .values({
      username: 'restricted_user',
      passwordHash: restrictedHash,
      role: 'restricted_user',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: {
        passwordHash: restrictedHash,
        role: 'restricted_user',
        isActive: true,
      },
    });

  console.log(
    '  [E2E] Seeded test users: viewer, sales, finance, warehouse, procurement, system, restricted_user',
  );
}
