import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  contacts,
  actorContactLinks,
  actors,
  projects,
  projectContacts,
} from '@herobm/db-schema';
import { NotFoundException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { PROJECT_STATE, CONTACT_STATE } from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('ContactsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ContactsService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(actorContactLinks);
    await pg.db.delete(projectContacts);
    await pg.db.delete(projects);
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
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();
      expect(result.firstName).toBe('John');
      expect(result.fullName).toBe('John Doe');
      expect(emitEvent).toHaveBeenCalled();
    });

    it('should create a contact and link to an actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({ name: 'Test Actor', isTaxRegistered: false })
        .returning();

      const result = await service.createContact(
        {
          firstName: 'Jane',
          lastName: 'Smith',
          entityType: 'actor',
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

    it('should create a contact and link to a project', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Test Project',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();

      const result = await service.createContact(
        {
          firstName: 'Project',
          lastName: 'Manager',
          entityType: 'project',
          entityId: project.projectId,
          projectRoles: ['manager'],
        },
        mockUserId,
      );

      expect(result.contactId).toBeDefined();

      const links = await pg.db.query.projectContacts.findMany({
        where: eq(projectContacts.contactId, result.contactId),
      });
      expect(links.length).toBe(1);
      expect(links[0].projectId).toBe(project.projectId);
      expect(links[0].roles).toEqual(['manager']);
    });

    it('should throw NotFoundException if linked actor does not exist', async () => {
      await expect(
        service.createContact(
          {
            firstName: 'No',
            lastName: 'Actor',
            entityType: 'actor',
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
          firstName: 'Old',
          lastName: 'Name',
        })
        .returning();

      const result = await service.updateContact(
        contact.contactId,
        {
          firstName: 'New',
        },
        mockUserId,
      );

      expect(result.firstName).toBe('New');
      expect(result.fullName).toBe('New Name');
      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.contacts.findFirst({
        where: eq(contacts.contactId, contact.contactId),
      });
      expect(dbRecord?.firstName).toBe('New');
    });

    it('should update primaryFor on links', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({ firstName: 'Test' })
        .returning();
      const [actor] = await pg.db
        .insert(actors)
        .values({ name: 'Actor', isTaxRegistered: false })
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
        .values({ firstName: 'Delete' })
        .returning();
      const [actor] = await pg.db
        .insert(actors)
        .values({ name: 'Actor', isTaxRegistered: false })
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
        .values({ firstName: 'To Archive' })
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
});
