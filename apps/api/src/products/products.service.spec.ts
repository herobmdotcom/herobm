import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  products,
  masterDataEvents,
  uomDictionary,
  projectResources,
  users,
} from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import {
  PRODUCT_STATE,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
  RESOURCE_TYPE,
} from '@herobm/shared';
import { EventType, EntityType } from '../common/event-types';

describe('ProductsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ProductsService;

  beforeEach(async () => {
    await pg.db.delete(projectResources);
    await pg.db.delete(users);
    await pg.db.delete(masterDataEvents);
    await pg.db.delete(products);

    // Seed required UOM
    await pg.db
      .insert(uomDictionary)
      .values([
        {
          uomCode: 'EA',
          description: 'Each',
          category: 'goods',
        },
        {
          uomCode: 'HOUR',
          description: 'Hour',
          category: 'service',
        },
      ])
      .onConflictDoNothing();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await pg.db.insert(products).values([
        {
          productId: '11111111-1111-1111-1111-111111111111',
          productNumber: 'BOLT-M8',
          name: 'M8 Hex Bolt',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
          productType: 'inventory',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
        {
          productId: '22222222-2222-2222-2222-222222222222',
          productNumber: 'NUT-M8',
          name: 'M8 Hex Nut',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
          productType: 'inventory',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
      ]);
    });

    it('should return paginated products with total count', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('total', 2);
    });

    it('should apply search filter when q is provided', async () => {
      const result = await service.findAll({ q: 'bolt' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].productNumber).toBe('BOLT-M8');
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });

    it('should filter by productType', async () => {
      await pg.db.insert(products).values({
        productId: '33333333-3333-3333-3333-333333333333',
        productNumber: 'SRV-TEST',
        name: 'Test Service Role',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'HOUR',
        productType: 'service',
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      const serviceRes = await service.findAll({ productType: 'service' });
      expect(serviceRes.data).toHaveLength(1);
      expect(serviceRes.data[0].productNumber).toBe('SRV-TEST');

      const invRes = await service.findAll({ productType: 'inventory' });
      expect(invRes.data).toHaveLength(2);

      const multiRes = await service.findAll({
        productType: 'service,inventory',
      });
      expect(multiRes.data).toHaveLength(3);
    });
  });

  describe('findOne', () => {
    const targetId = '11111111-1111-1111-1111-111111111111';

    beforeEach(async () => {
      await pg.db.insert(products).values({
        productId: targetId,
        productNumber: 'BOLT-M8',
        name: 'M8 Hex Bolt',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        productType: 'inventory',
        source: 'app',
        structureType: 'standard',
        createdBy: 'system',
      });

      await pg.db.insert(masterDataEvents).values({
        entityId: targetId,
        entityType: EntityType.PRODUCT,
        eventType: EventType.CREATED,
        payload: { name: 'M8 Hex Bolt' },
        actor: 'admin',
      });
    });

    it('should return a single product with events', async () => {
      const result = await service.findOne(targetId);
      expect(result.productNumber).toBe('BOLT-M8');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('created');
    });

    it('should throw NotFoundException for unknown ID', async () => {
      await expect(
        service.findOne('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCostSummary', () => {
    const targetId = '11111111-1111-1111-1111-111111111111';

    beforeEach(async () => {
      await pg.db.insert(products).values({
        productId: targetId,
        productNumber: 'BOLT-M8',
        name: 'M8 Hex Bolt',
        stateCode: PRODUCT_STATE.ACTIVE,
        baseUom: 'EA',
        productType: 'inventory',
        source: 'app',
        structureType: 'standard',
        standardCost: '12.50',
        weightedAverageCost: '11.85',
        listPrice: '20.00',
        tradePrice: '16.00',
        createdBy: 'system',
      });
    });

    it('should return cost summary for existing product', async () => {
      const result = await service.getCostSummary(targetId);
      expect(result.productId).toBe(targetId);
      expect(result.standardCost).toBe('12.50');
      expect(result.weightedAverageCost).toBe('11.85');
      expect(result.listPrice).toBe('20.00');
      expect(result.tradePrice).toBe('16.00');
    });

    it('should throw NotFoundException for non-existent product', async () => {
      await expect(
        service.getCostSummary('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid non-UUID', async () => {
      await expect(service.getCostSummary('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('service members management', () => {
    const serviceProductId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const nonServiceProductId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const personResourceId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const contractorResourceId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    beforeEach(async () => {
      await pg.db.insert(products).values([
        {
          productId: serviceProductId,
          productNumber: 'SRV-CONSULT',
          name: 'Consulting Service',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
          productType: 'service',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
        {
          productId: nonServiceProductId,
          productNumber: 'MAT-STEEL',
          name: 'Raw Steel',
          stateCode: PRODUCT_STATE.ACTIVE,
          baseUom: 'EA',
          productType: 'inventory',
          source: 'app',
          structureType: 'standard',
          createdBy: 'system',
        },
      ]);

      await pg.db.insert(projectResources).values({
        resourceId: personResourceId,
        resourceNumber: 'RES-P1',
        name: 'Jane Engineer',
        resourceType: RESOURCE_TYPE.PERSON,
        baseUom: 'HOUR',
        directUnitCost: '50.00',
        unitPrice: '100.00',
        isActive: true,
      });
      await pg.db.insert(projectResources).values({
        resourceId: contractorResourceId,
        resourceNumber: 'RES-C1',
        name: 'Acme Contractor',
        resourceType: RESOURCE_TYPE.CONTRACTOR,
        baseUom: 'HOUR',
        directUnitCost: '70.00',
        unitPrice: '120.00',
        isActive: true,
      });
    });

    it('should retrieve a person resource assigned to a service product via serviceProductId', async () => {
      const directResourceId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      await pg.db.insert(projectResources).values({
        resourceId: directResourceId,
        resourceNumber: 'RES-P2',
        name: 'Bob Architect',
        resourceType: RESOURCE_TYPE.PERSON,
        serviceProductId: serviceProductId,
        baseUom: 'HOUR',
        directUnitCost: '80.00',
        unitPrice: '150.00',
        isActive: true,
      });

      const members = await service.getServiceMembers(serviceProductId);
      expect(members).toHaveLength(1);
      expect(members[0].resourceId).toBe(directResourceId);
      expect(members[0].name).toBe('Bob Architect');
      expect(members[0].productId).toBe(serviceProductId);

      const product = await service.findOne(serviceProductId);
      expect(product.serviceMembers).toBeDefined();
      expect(product.serviceMembers).toHaveLength(1);
      expect(product.serviceMembers[0].resourceId).toBe(directResourceId);
    });

    it('should add and retrieve a person member for a service product', async () => {
      const added = await service.addServiceMember(
        serviceProductId,
        personResourceId,
        'admin',
      );

      expect(added?.resourceId).toBe(personResourceId);
      expect(added?.productId).toBe(serviceProductId);
      expect(added?.name).toBe('Jane Engineer');

      const members = await service.getServiceMembers(serviceProductId);
      expect(members).toHaveLength(1);
      expect(members[0].resourceId).toBe(personResourceId);
      expect(members[0].name).toBe('Jane Engineer');
    });

    it('should throw BadRequestException if adding a non-person resource to a service product', async () => {
      await expect(
        service.addServiceMember(
          serviceProductId,
          contractorResourceId,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if adding a member to a non-service product', async () => {
      await expect(
        service.addServiceMember(
          nonServiceProductId,
          personResourceId,
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing member when adding duplicate member to service product', async () => {
      await service.addServiceMember(
        serviceProductId,
        personResourceId,
        'admin',
      );

      const duplicate = await service.addServiceMember(
        serviceProductId,
        personResourceId,
        'admin',
      );
      expect(duplicate?.resourceId).toBe(personResourceId);
    });

    it('should remove a member from a service product', async () => {
      await service.addServiceMember(
        serviceProductId,
        personResourceId,
        'admin',
      );

      const removeRes = await service.removeServiceMember(
        serviceProductId,
        personResourceId,
        'admin',
      );
      expect(removeRes).toEqual({
        deleted: true,
        productId: serviceProductId,
        resourceId: personResourceId,
      });

      const members = await service.getServiceMembers(serviceProductId);
      expect(members).toHaveLength(0);
    });
  });

  describe('settings management', () => {
    it('should get and update product domain settings', async () => {
      const initial = await service.getSettings();
      expect(initial).toBeDefined();

      const schemaPayload = {
        fields: [{ name: 'custom_field', type: 'string' }],
      };
      const updated = await service.updateSettings({
        productMetadataSchema: schemaPayload,
      });

      expect(updated.productMetadataSchema).toEqual(schemaPayload);

      const retrieved = await service.getSettings();
      expect(retrieved.productMetadataSchema).toEqual(schemaPayload);
    });
  });
});
