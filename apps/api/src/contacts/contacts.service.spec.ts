import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  contacts,
  actorContactLinks,
  actors,
  suppliers,
  opportunities,
  opportunityContacts,
} from '@herobm/db-schema';
import { NotFoundException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import {
  OPPORTUNITY_STATE,
  CONTACT_STATE,
  ACTOR_STATE,
  SUPPLIER_STATE,
  ContactEntityType,
} from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('ContactsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ContactsService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(actorContactLinks);
    await pg.db.delete(opportunityContacts);
    await pg.db.delete(opportunities);
    await pg.db.delete(suppliers);
    await pg.db.delete(actors);
    await pg.db.delete(contacts);
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createContact', () => {
    it('should create a standalone contact', async () => {
      const result = await service.createContact(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          mobile: '555-1234',
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();
      expect(result.firstName).toBe('John');
      expect(result.fullName).toBe('John Doe');
      expect(result.mobile).toBe('555-1234');
      expect(emitEvent).toHaveBeenCalled();
    });

    it('should create a contact and link to an actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Test Actor',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.createContact(
        {
          firstName: 'Jane',
          lastName: 'Smith',
          entityType: ContactEntityType.ACTOR,
          entityId: actor.actorId,
          primaryFor: ['billing'],
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();

      const links = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.contactId, result.contactId),
      });
      expect(links.length).toBe(1);
      expect(links[0].actorId).toBe(actor.actorId);
      expect(links[0].primaryFor).toEqual(['billing']);
    });

    it('should create a contact and link to a supplier (ADV-181)', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Supplier Actor',
          isTaxRegistered: false,
        })
        .returning();

      const [supplier] = await pg.db
        .insert(suppliers)
        .values({
          stateCode: SUPPLIER_STATE.ACTIVE,
          actorId: actor.actorId,
          vendorNumber: 'VEND-999',
          currencyCode: 'USD',
          source: 'app',
          createdBy: 'system',
          isPurchasingBlocked: false,
          isPaymentBlocked: false,
        })
        .returning();

      const result = await service.createContact(
        {
          firstName: 'Supplier',
          lastName: 'Rep',
          entityType: ContactEntityType.SUPPLIER,
          entityId: supplier.vendorId,
          primaryFor: ['purchasing'],
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();

      const links = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.contactId, result.contactId),
      });
      expect(links.length).toBe(1);
      expect(links[0].actorId).toBe(actor.actorId);
      expect(links[0].primaryFor).toEqual(['purchasing']);
    });

    it('should create a contact and link to an opportunity', async () => {
      const [opportunity] = await pg.db
        .insert(opportunities)
        .values({
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          name: 'Test Opportunity',
          type: 'new_business',
          status: OPPORTUNITY_STATE.ACTIVE,
        })
        .returning();

      const result = await service.createContact(
        {
          firstName: 'Project',
          lastName: 'Manager',
          entityType: ContactEntityType.OPPORTUNITY,
          entityId: opportunity.opportunityId,
          opportunityRoles: ['manager'],
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();

      const links = await pg.db.query.opportunityContacts.findMany({
        where: eq(opportunityContacts.contactId, result.contactId),
      });
      expect(links.length).toBe(1);
      expect(links[0].opportunityId).toBe(opportunity.opportunityId);
      expect(links[0].roles).toEqual(['manager']);
    });

    it('should throw NotFoundException if linked actor does not exist', async () => {
      await expect(
        service.createContact(
          {
            firstName: 'No',
            lastName: 'Actor',
            entityType: ContactEntityType.ACTOR,
            entityId: randomUUID(),
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContact', () => {
    it('should update an existing contact', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'Old',
          lastName: 'Name',
        })
        .returning();

      const result = await service.updateContact(
        contact.contactId,
        {
          firstName: 'New',
          mobile: '555-9999',
        },
        mockUserId,
      );

      expect(result.firstName).toBe('New');
      expect(result.fullName).toBe('New Name');
      expect(result.mobile).toBe('555-9999');
      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contact.contactId),
      });
      expect(dbRecord?.firstName).toBe('New');
    });

    it('should update primaryFor on links', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'Test',
        })
        .returning();
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Actor',
          isTaxRegistered: false,
        })
        .returning();
      await pg.db.insert(actorContactLinks).values({
        actorId: actor.actorId,
        contactId: contact.contactId,
        primaryFor: [],
        linkType: 'employee',
      });

      await service.updateContact(
        contact.contactId,
        {
          primaryFor: ['shipping'],
        },
        mockUserId,
      );

      const links = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.contactId, contact.contactId),
      });
      expect(links[0].primaryFor).toEqual(['shipping']);
    });

    it('should throw NotFoundException if contact to update does not exist', async () => {
      await expect(
        service.updateContact(randomUUID(), {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteContact', () => {
    it('should delete a contact and its links', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'Delete',
        })
        .returning();
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Actor',
          isTaxRegistered: false,
        })
        .returning();
      await pg.db.insert(actorContactLinks).values({
        actorId: actor.actorId,
        contactId: contact.contactId,
        primaryFor: [],
        linkType: 'employee',
      });

      await service.deleteContact(contact.contactId, mockUserId);

      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contact.contactId),
      });
      expect(dbRecord).toBeUndefined();

      const links = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.contactId, contact.contactId),
      });
      expect(links.length).toBe(0);
    });

    it('should throw NotFoundException if contact to delete does not exist', async () => {
      await expect(
        service.deleteContact(randomUUID(), mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('archiveContact', () => {
    it('should archive a contact', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'To Archive',
        })
        .returning();

      const res = await service.archiveContact(contact.contactId, mockUserId);
      expect(res.stateCode).toBe(CONTACT_STATE.ARCHIVED);

      const dbRecord = await pg.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contact.contactId),
      });
      expect(dbRecord?.stateCode).toBe(CONTACT_STATE.ARCHIVED);
    });
  });

  describe('unarchiveContact', () => {
    it('should unarchive a contact', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'To Unarchive',
          stateCode: CONTACT_STATE.ARCHIVED,
        })
        .returning();

      const res = await service.unarchiveContact(contact.contactId, mockUserId);
      expect(res.stateCode).toBe(CONTACT_STATE.ACTIVE);

      const dbRecord = await pg.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contact.contactId),
      });
      expect(dbRecord?.stateCode).toBe(CONTACT_STATE.ACTIVE);
    });
  });

  describe('getContact', () => {
    it('should retrieve a contact with linked actors', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Affiliated Corp',
          industry: 'Logistics',
          isTaxRegistered: false,
        })
        .returning();

      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'Alice',
          lastName: 'Wonderland',
        })
        .returning();

      await pg.db.insert(actorContactLinks).values({
        actorId: actor.actorId,
        contactId: contact.contactId,
        linkType: 'employee',
        primaryFor: ['billing', 'shipping'],
      });

      const res = await service.getContact(contact.contactId);
      expect(res.contactId).toBe(contact.contactId);
      expect(res.firstName).toBe('Alice');
      expect((res as any).actorContactLinks).toBeDefined();
      expect((res as any).actorContactLinks.length).toBe(1);
      expect((res as any).actorContactLinks[0].actor?.name).toBe(
        'Affiliated Corp',
      );
    });

    it('should throw NotFoundException if contact does not exist', async () => {
      await expect(service.getContact(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
