import { Test, TestingModule } from '@nestjs/testing';
import { UomService } from './uom.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { products, productUoms, uomDictionary } from '../drizzle/schema';
import { PRODUCT_STATE } from '@herobm/shared';
import { eq } from 'drizzle-orm';

describe('UomService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: UomService;

  const PRODUCT_ID = '00000000-0000-4000-8000-00000000000a';

  beforeEach(async () => {
    // Seed required UOMs
    await pg.db.insert(uomDictionary).values([
      { uomCode: 'EA', description: 'Each' },
      { uomCode: 'BOX', description: 'Box' },
      { uomCode: 'VPE025', description: 'Pack 25' },
    ]);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UomService,
        {
          provide: DRIZZLE,
          useValue: pg.db,
        },
      ],
    }).compile();

    service = module.get<UomService>(UomService);

    // Clean transactional data
    await pg.db.delete(productUoms);
    await pg.db.delete(products);
  });

  describe('calculateAbsoluteBaseQuantity', () => {
    it('returns 0 if lines are empty', async () => {
      const result = await service.calculateAbsoluteBaseQuantity(
        PRODUCT_ID,
        [],
      );
      expect(result).toBe(0);
    });

    it('throws NotFoundException if product is missing', async () => {
      await expect(
        service.calculateAbsoluteBaseQuantity(PRODUCT_ID, [{ quantity: 1 }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('calculates correctly using baseUom and standard ratios', async () => {
      await pg.db.insert(products).values({
        productId: PRODUCT_ID,
        productNumber: 'P1',
        name: 'Product 1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await pg.db.insert(productUoms).values([
        { productId: PRODUCT_ID, uomCode: 'BOX', ratio: '10' },
        { productId: PRODUCT_ID, uomCode: 'VPE025', ratio: '25' },
      ]);

      const lines = [
        { uomCode: 'BOX', quantity: 2 }, // 20
        { uomCode: 'VPE025', quantity: 5 }, // 125
        { uomCode: 'EA', quantity: 7 }, // 7
        { quantity: 1 }, // 1 (defaults to base uom 'EA')
      ];

      const result = await service.calculateAbsoluteBaseQuantity(
        PRODUCT_ID,
        lines,
      );

      expect(result).toBe(20 + 125 + 7 + 1); // 153
    });

    it('throws exact Error message for unmapped UOMs', async () => {
      await pg.db.insert(products).values({
        productId: PRODUCT_ID,
        productNumber: 'P1',
        name: 'Product 1',
        baseUom: 'EA',
        productType: 'inventory',
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await expect(
        service.calculateAbsoluteBaseQuantity(PRODUCT_ID, [
          { uomCode: 'UNKNOWN', quantity: 1 },
        ]),
      ).rejects.toThrow(
        `UOM 'UNKNOWN' is not configured for product ${PRODUCT_ID}.`,
      );
    });
  });
});
