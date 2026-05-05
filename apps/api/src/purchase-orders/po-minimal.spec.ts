import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { SuppliersService } from '../suppliers/suppliers.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';
import { createMemoryDb } from '../../test/utils/memory-db';
import {
  purchaseOrders,
  locations,
  suppliers,
} from '../drizzle/modbm-core-schema';

describe('PurchaseOrdersService Minimal', () => {
  let service: PurchaseOrdersService;
  let db: any;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: db },
        { provide: InventoryService, useValue: {} },
        { provide: SuppliersService, useValue: {} },
        { provide: TaxCategoriesService, useValue: {} },
        { provide: AppConfigService, useValue: { homeCurrency: () => 'EUR' } },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  it('should find one PO', async () => {
    const VENDOR_ID = '00000000-0000-0000-0000-000000000002';
    const LOCATION_ID = '00000000-0000-0000-0000-00000000000f';
    const PO_ID = '00000000-0000-0000-0000-000000000001';

    await db.insert(suppliers).values({ vendorId: VENDOR_ID, vendorNumber: 'V1', name: 'V' });
    await db.insert(locations).values({ locationId: LOCATION_ID, code: 'L1', name: 'L' });
    await db.insert(purchaseOrders).values({
      purchaseOrderId: PO_ID,
      orderNumber: 'PO-1',
      vendorId: VENDOR_ID,
      deliveryLocationId: LOCATION_ID,
      currencyCode: 'EUR',
      stateCode: 'draft',
    });

    const result = await service.findOne(PO_ID);
    expect(result.purchaseOrderId).toBe(PO_ID);
  });
});
