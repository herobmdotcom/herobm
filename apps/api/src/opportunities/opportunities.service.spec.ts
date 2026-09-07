import { Test, TestingModule } from '@nestjs/testing';
import { OpportunitiesService } from './opportunities.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  opportunities,
  opportunityNotes,
  opportunityContacts,
  opportunityActors,
  contacts,
  actors,
  users,
  salesOrders,
  salesOrderLineItems,
  customers,
  locations,
} from '@herobm/db-schema';
import { NotFoundException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import {
  OPPORTUNITY_STATE,
  ACTOR_STATE,
  CONTACT_STATE,
  SALES_ORDER_STATE,
  CUSTOMER_STATE,
} from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('OpportunitiesService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OpportunitiesService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(salesOrderLineItems);
    await pg.db.delete(salesOrders);
    await pg.db.delete(opportunityActors);
    await pg.db.delete(opportunityContacts);
    await pg.db.delete(opportunityNotes);
    await pg.db.delete(opportunities);
    await pg.db.delete(customers);
    await pg.db.delete(contacts);
    await pg.db.delete(actors);

    await pg.db
      .insert(users)
      .values({
        userId: mockUserId,
        username: 'mockuser',
        // eslint-disable-next-line no-restricted-syntax -- Mocking a test user password
        passwordHash: 'hash',
        role: 'admin',
        displayName: 'Mock User',
        email: 'mock@example.com',
        isActive: true,
      })
      .onConflictDoNothing();

    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OpportunitiesService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<OpportunitiesService>(OpportunitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOpportunity', () => {
    it('should create an opportunity with commercial fields', async () => {
      const result = await service.createOpportunity(
        {
          name: 'Test Deal',
          status: 'qualification',
          type: 'commercial',
          estimatedValue: '150000',
          currencyCode: 'USD',
          probability: 75,
          targetCloseDate: new Date('2026-12-31').toISOString(),
          description: 'Strategic ERP rollout',
        },
        mockUserId,
      );

      expect(result.opportunityId).toBeDefined();
      expect(result.name).toBe('Test Deal');
      expect(result.status).toBe('qualification');
      expect(result.estimatedValue).toBe('150000');
      expect(result.probability).toBe(75);
      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.opportunities.findFirst({
        where: eq(opportunities.opportunityId, result.opportunityId),
      });
      expect(dbRecord).toBeDefined();
    });
  });

  describe('updateOpportunity', () => {
    it('should update an opportunity including stage and probability', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Old Deal',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const result = await service.updateOpportunity(
        opp.opportunityId,
        {
          name: 'New Deal Name',
          status: 'proposal',
          probability: 80,
          estimatedValue: '250000',
        },
        mockUserId,
      );

      expect(result.name).toBe('New Deal Name');
      expect(result.status).toBe('proposal');
      expect(result.probability).toBe(80);
      expect(emitEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException if opportunity does not exist', async () => {
      await expect(
        service.updateOpportunity(
          randomUUID(),
          { name: 'Nonexistent' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveOpportunity and unarchiveOpportunity', () => {
    it('should archive and unarchive an opportunity', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Archive Test',
          type: 'commercial',
          status: 'won',
        })
        .returning();

      const archived = await service.archiveOpportunity(
        opp.opportunityId,
        mockUserId,
      );
      expect(archived.stateCode).toBe(OPPORTUNITY_STATE.ARCHIVED);

      const unarchived = await service.unarchiveOpportunity(
        opp.opportunityId,
        mockUserId,
      );
      expect(unarchived.stateCode).toBe(OPPORTUNITY_STATE.ACTIVE);
    });
  });

  describe('getOpportunity', () => {
    it('should get an opportunity with linked actors, contacts, and notes', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Full Opp',
          type: 'commercial',
          status: 'negotiation',
        })
        .returning();

      const [actor] = await pg.db
        .insert(actors)
        .values({
          name: 'Client Corp',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      await service.addOpportunityActor(
        opp.opportunityId,
        { actorId: actor.actorId, roles: ['client'] },
        mockUserId,
      );

      await service.addOpportunityNote(
        opp.opportunityId,
        { content: 'Important note' },
        mockUserId,
      );

      const fetched = await service.getOpportunity(opp.opportunityId);
      expect(fetched.name).toBe('Full Opp');
      expect(fetched.opportunityActors?.length).toBe(1);
      expect(fetched.notes?.length).toBe(1);
    });
  });

  describe('getOpportunities', () => {
    it('should support stage filtering and eager-load actors', async () => {
      const [opp1] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Opp Stage 1',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const [opp2] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Opp Stage 2',
          type: 'commercial',
          status: 'won',
        })
        .returning();

      const res = await service.getOpportunities({ status: 'won' });
      expect(res.data.length).toBe(1);
      expect(res.data[0].name).toBe('Opp Stage 2');
    });
  });

  describe('deleteOpportunity', () => {
    it('should delete an opportunity', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Delete Me',
          type: 'commercial',
          status: 'lost',
        })
        .returning();

      const res = await service.deleteOpportunity(
        opp.opportunityId,
        mockUserId,
      );
      expect(res.success).toBe(true);

      const check = await pg.db.query.opportunities.findFirst({
        where: eq(opportunities.opportunityId, opp.opportunityId),
      });
      expect(check).toBeUndefined();
    });
  });

  describe('Sub-resource Management', () => {
    it('should add and delete opportunity contacts', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Contact Test Opp',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const [c] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Jane',
          lastName: 'Doe',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const linked = await service.addOpportunityContact(
        opp.opportunityId,
        { contactId: c.contactId, roles: ['decision_maker'] },
        mockUserId,
      );
      expect(linked.success).toBe(true);

      const dbLinked = await pg.db.query.opportunityContacts.findFirst({
        where: eq(opportunityContacts.opportunityId, opp.opportunityId),
      });
      expect(dbLinked?.contactId).toBe(c.contactId);
      expect(dbLinked?.roles).toContain('decision_maker');

      const delRes = await service.deleteOpportunityContact(
        opp.opportunityId,
        c.contactId,
        mockUserId,
      );
      expect(delRes.success).toBe(true);

      const check = await pg.db.query.opportunityContacts.findFirst({
        where: eq(opportunityContacts.opportunityId, opp.opportunityId),
      });
      expect(check).toBeUndefined();
    });

    it('should add and delete opportunity notes', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Notes Test Opp',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const note = await service.addOpportunityNote(
        opp.opportunityId,
        { content: 'Internal review meeting' },
        mockUserId,
      );
      expect(note.content).toBe('Internal review meeting');

      const delRes = await service.deleteOpportunityNote(
        opp.opportunityId,
        note.noteId,
        mockUserId,
      );
      expect(delRes.success).toBe(true);

      const check = await pg.db.query.opportunityNotes.findFirst({
        where: eq(opportunityNotes.noteId, note.noteId),
      });
      expect(check).toBeUndefined();
    });

    it('should delete opportunity actors', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Actor Unlink Opp',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const [a] = await pg.db
        .insert(actors)
        .values({
          name: 'Partner LLC',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      await service.addOpportunityActor(
        opp.opportunityId,
        { actorId: a.actorId, roles: ['consultant'] },
        mockUserId,
      );

      const delRes = await service.deleteOpportunityActor(
        opp.opportunityId,
        a.actorId,
        mockUserId,
      );
      expect(delRes.success).toBe(true);

      const check = await pg.db.query.opportunityActors.findFirst({
        where: eq(opportunityActors.opportunityId, opp.opportunityId),
      });
      expect(check).toBeUndefined();
    });
  });

  describe('Pagination', () => {
    it('should respect limit and return cursor for opportunities', async () => {
      for (let i = 1; i <= 5; i++) {
        await pg.db.insert(opportunities).values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: `Opp Page ${i}`,
          type: 'commercial',
          status: 'prospect',
        });
      }

      const page1 = await service.getOpportunities({ limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await service.getOpportunities({
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.data.length).toBe(2);
      expect(page2.data[0].opportunityId).not.toBe(page1.data[0].opportunityId);
    });
  });

  describe('Live Deal Revenue & Quotes Aggregation', () => {
    it('should aggregate live dealRevenue and quoteCount across linked sales orders', async () => {
      // Create Opportunity
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Construction Deal',
          type: 'commercial',
          status: 'proposal',
        })
        .returning();

      // Create Actor and Customer
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Apex Builder',
          isTaxRegistered: false,
        })
        .returning();

      const [cust] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'CUST-001',
          currencyCode: 'EUR',
          stateCode: CUSTOMER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const [loc] = await pg.db
        .insert(locations)
        .values({
          code: 'LOC-01',
          name: 'Main Hub',
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      // Order 1: Active quote (1500.50)
      const [so1] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'Q-001',
          name: 'Quote 1',
          customerId: cust.customerId,
          opportunityId: opp.opportunityId,
          stateCode: SALES_ORDER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
          fulfillmentLocationId: loc.locationId,
          currencyCode: 'EUR',
          exchangeRate: '1.0',
          discrepanciesAcknowledged: false,
        })
        .returning();

      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderId: so1.salesOrderId,
          lineNumber: 1,
          quantity: '2',
          pricePerUnit: '500.00',
          totalAmount: '1000.00',
        },
        {
          salesOrderId: so1.salesOrderId,
          lineNumber: 2,
          quantity: '1',
          pricePerUnit: '500.50',
          totalAmount: '500.50',
        },
      ]);

      // Order 2: Active quote (3500.00)
      const [so2] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'Q-002',
          name: 'Quote 2',
          customerId: cust.customerId,
          opportunityId: opp.opportunityId,
          stateCode: SALES_ORDER_STATE.CONFIRMED,
          source: 'app',
          createdBy: 'system',
          fulfillmentLocationId: loc.locationId,
          currencyCode: 'EUR',
          exchangeRate: '1.0',
          discrepanciesAcknowledged: false,
        })
        .returning();

      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderId: so2.salesOrderId,
          lineNumber: 1,
          quantity: '1',
          pricePerUnit: '3500.00',
          totalAmount: '3500.00',
        },
      ]);

      // Order 3: Cancelled quote (9999.00) - Should NOT be included in dealRevenue
      const [so3] = await pg.db
        .insert(salesOrders)
        .values({
          orderNumber: 'Q-003',
          name: 'Quote 3 (Cancelled)',
          customerId: cust.customerId,
          opportunityId: opp.opportunityId,
          stateCode: SALES_ORDER_STATE.CANCELLED,
          source: 'app',
          createdBy: 'system',
          fulfillmentLocationId: loc.locationId,
          currencyCode: 'EUR',
          exchangeRate: '1.0',
          discrepanciesAcknowledged: false,
        })
        .returning();

      await pg.db.insert(salesOrderLineItems).values([
        {
          salesOrderId: so3.salesOrderId,
          lineNumber: 1,
          quantity: '1',
          pricePerUnit: '9999.00',
          totalAmount: '9999.00',
        },
      ]);

      // 1. Verify getOpportunity returns accurate live dealRevenue and quoteCount
      const fetchedOpp = await service.getOpportunity(opp.opportunityId);
      expect(fetchedOpp.dealRevenue).toBe(5000.5); // 1500.50 + 3500.00
      expect(fetchedOpp.quoteCount).toBe(2);

      // 2. Verify getOpportunities list returns batch dealRevenue and quoteCount
      const list = await service.getOpportunities();
      const oppInList = list.data.find(
        (o) => o.opportunityId === opp.opportunityId,
      );
      expect(oppInList).toBeDefined();
      expect(oppInList?.dealRevenue).toBe(5000.5);
      expect(oppInList?.quoteCount).toBe(2);
    });

    it('should return 0 dealRevenue and 0 quoteCount when no quotes are linked', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Empty Deal',
          type: 'commercial',
          status: 'prospect',
        })
        .returning();

      const fetchedOpp = await service.getOpportunity(opp.opportunityId);
      expect(fetchedOpp.dealRevenue).toBe(0);
      expect(fetchedOpp.quoteCount).toBe(0);
    });
  });
});
