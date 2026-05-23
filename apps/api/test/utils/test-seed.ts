import { locations, zones, bins } from '../../src/drizzle/modbm-core-schema';

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

  console.log("  Seeded test 'MAIN' location, zone, and bins");
}
