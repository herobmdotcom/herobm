import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedStateService } from './goods-received-state.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { goodsReceived, suppliers, locations } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { GOODS_RECEIVED_STATE, SUPPLIER_STATE } from '@herobm/shared';
import { GoodsReceivedCoreService } from './goods-received-core.service';

describe('GoodsReceivedStateService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: GoodsReceivedStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceivedStateService,
        {
          provide: GoodsReceivedCoreService,
          useValue: {},
        },
        { provide: DRIZZLE, useValue: pg.db },
      ],
    }).compile();

    service = module.get<GoodsReceivedStateService>(GoodsReceivedStateService);

    await pg.db.delete(goodsReceived);
    await pg.db.delete(suppliers);
    await pg.db.delete(locations);

    await pg.db.insert(suppliers).values({
      vendorId: '00000000-0000-4000-8000-000000000010',
      vendorNumber: 'V-001',
      currencyCode: 'USD',
      stateCode: SUPPLIER_STATE.ACTIVE,
      isPurchasingBlocked: false,
      source: 'app',
      createdBy: 'system',
    });
    await pg.db.insert(locations).values({
      locationId: '00000000-0000-4000-8000-000000000011',
      name: 'Test Location',
      code: 'LOC',
      source: 'app',
      createdBy: 'system',
    });
  });

  describe('changeReceiptState', () => {
    it('should update the state of a receipt', async () => {
      const receiptId = '00000000-0000-4000-8000-000000000001';
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: receiptId,
        receiptNumber: 'GR-001',
        vendorId: '00000000-0000-4000-8000-000000000010',
        locationId: '00000000-0000-4000-8000-000000000011',
        stateCode: GOODS_RECEIVED_STATE.RECEIVED,
      });

      await service.changeReceiptState(
        receiptId,
        GOODS_RECEIVED_STATE.CANCELLED,
        'admin',
        pg.db as any,
      );

      const [updated] = await pg.db
        .select()
        .from(goodsReceived)
        .where(eq(goodsReceived.goodsReceivedId, receiptId));

      expect(updated.stateCode).toBe(GOODS_RECEIVED_STATE.CANCELLED);
    });

    it('should throw NotFoundException if receipt does not exist', async () => {
      await expect(
        service.changeReceiptState(
          '00000000-0000-4000-8000-000000000999',
          GOODS_RECEIVED_STATE.CANCELLED,
          'admin',
          pg.db as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transition is invalid', async () => {
      const receiptId = '00000000-0000-4000-8000-000000000001';
      await pg.db.insert(goodsReceived).values({
        goodsReceivedId: receiptId,
        receiptNumber: 'GR-001',
        vendorId: '00000000-0000-4000-8000-000000000010',
        locationId: '00000000-0000-4000-8000-000000000011',
        stateCode: GOODS_RECEIVED_STATE.CANCELLED,
      });

      // Cannot transition from CANCELLED to RECEIVED
      await expect(
        service.changeReceiptState(
          receiptId,
          GOODS_RECEIVED_STATE.RECEIVED,
          'admin',
          pg.db as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
