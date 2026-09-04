import { Test, TestingModule } from '@nestjs/testing';
import { ActorsService } from './actors.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  actors,
  actorContactLinks,
  actorActorLinks,
  actorNotes,
  contacts,
  users,
} from '@herobm/db-schema';
import { ACTOR_STATE, CONTACT_STATE } from '@herobm/shared';
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

describe('ActorsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ActorsService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(actorActorLinks);
    await pg.db.delete(actorContactLinks);
    await pg.db.delete(actorNotes);
    await pg.db.delete(actors);
    await pg.db.delete(contacts);

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActorsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ActorsService>(ActorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createActor', () => {
    it('should create an actor', async () => {
      const dto = {
        name: 'Test Actor',
        email: 'test@actor.com',
        phone: '1234567890',
      };

      const result = await service.createActor(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.actorId).toBeDefined();
      expect(result.name).toBe('Test Actor');
      expect(result.email).toBe('test@actor.com');

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, result.actorId),
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.name).toBe('Test Actor');
      expect(dbRecord?.isTaxRegistered).toBe(false);
    });

    it('should create an actor when isTaxRegistered is explicitly undefined', async () => {
      const dto = {
        name: 'Actor Without Tax Info',
        industry: 'Manufacturing',
        headquartersCountry: 'FR',
        email: 'actor@testing.com',
        isTaxRegistered: undefined,
      };

      const result = await service.createActor(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.actorId).toBeDefined();
      expect(result.name).toBe('Actor Without Tax Info');

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, result.actorId),
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.isTaxRegistered).toBe(false);
    });

    it('should create an actor with an assigned ownerId', async () => {
      const dto = {
        name: 'Actor With Owner',
        ownerId: mockUserId,
      };

      const result = await service.createActor(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.ownerId).toBe(mockUserId);

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, result.actorId),
      });

      expect(dbRecord?.ownerId).toBe(mockUserId);
    });
  });

  describe('getActor', () => {
    it('should return an actor by ID', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Existing Actor',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.getActor(actor.actorId);

      expect(result.actorId).toBe(actor.actorId);
      expect(result.name).toBe('Existing Actor');
    });

    it('should return an actor by ID with populated owner details', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Existing Actor with Owner',
          isTaxRegistered: false,
          ownerId: mockUserId,
        })
        .returning();

      const result = await service.getActor(actor.actorId);

      expect(result.actorId).toBe(actor.actorId);
      expect(result.ownerId).toBe(mockUserId);
      expect(result.owner).toBeDefined();
      expect(result.ownerDisplayName).toBe('Mock User');
    });

    it('should throw NotFoundException if actor not found', async () => {
      await expect(service.getActor(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateActor', () => {
    it('should update an existing actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Old Name',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.updateActor(
        actor.actorId,
        {
          name: 'New Name',
        },
        mockUserId,
      );

      expect(result.actorId).toBe(actor.actorId);
      expect(result.name).toBe('New Name');

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, actor.actorId),
      });
      expect(dbRecord?.name).toBe('New Name');
    });

    it('should assign and clear an actor owner', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Actor to assign',
          isTaxRegistered: false,
        })
        .returning();

      const updated = await service.updateActor(
        actor.actorId,
        { ownerId: mockUserId },
        mockUserId,
      );
      expect(updated.ownerId).toBe(mockUserId);

      const unassigned = await service.updateActor(
        actor.actorId,
        { ownerId: null },
        mockUserId,
      );
      expect(unassigned.ownerId).toBeNull();
    });

    it('should throw NotFoundException if actor to update does not exist', async () => {
      await expect(
        service.updateActor(randomUUID(), { name: 'New Name' }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteActor', () => {
    it('should delete an existing actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'To Delete',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.deleteActor(actor.actorId, mockUserId);
      expect(result.success).toBe(true);

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, actor.actorId),
      });
      expect(dbRecord).toBeUndefined();
    });

    it('should throw NotFoundException if actor to delete does not exist', async () => {
      await expect(
        service.deleteActor(randomUUID(), mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveActor', () => {
    it('should archive an actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'To Archive',
          isTaxRegistered: false,
        })
        .returning();

      const res = await service.archiveActor(actor.actorId, mockUserId);
      expect(res.stateCode).toBe(ACTOR_STATE.ARCHIVED);

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, actor.actorId),
      });
      expect(dbRecord?.stateCode).toBe(ACTOR_STATE.ARCHIVED);
    });
  });

  describe('unarchiveActor', () => {
    it('should unarchive an actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          name: 'To Unarchive',
          stateCode: ACTOR_STATE.ARCHIVED,
          isTaxRegistered: false,
        })
        .returning();

      const res = await service.unarchiveActor(actor.actorId, mockUserId);
      expect(res.stateCode).toBe(ACTOR_STATE.ACTIVE);

      const dbRecord = await pg.db.query.actors.findFirst({
        where: eq(actors.actorId, actor.actorId),
      });
      expect(dbRecord?.stateCode).toBe(ACTOR_STATE.ACTIVE);
    });
  });

  describe('sub-entities', () => {
    it('should add and remove a note', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Note Actor',
          isTaxRegistered: false,
        })
        .returning();

      const noteResult = await service.addNote(
        actor.actorId,
        { content: 'My Note' },
        mockUserId,
      );

      expect(noteResult.noteId).toBeDefined();
      expect(noteResult.content).toBe('My Note');

      const dbNotes = await pg.db.query.actorNotes.findMany({
        where: eq(actorNotes.actorId, actor.actorId),
      });
      expect(dbNotes.length).toBe(1);

      await service.removeNote(actor.actorId, noteResult.noteId, mockUserId);

      const dbNotesAfter = await pg.db.query.actorNotes.findMany({
        where: eq(actorNotes.actorId, actor.actorId),
      });
      expect(dbNotesAfter.length).toBe(0);
    });

    it('should add, update, and remove a contact', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Contact Actor',
          isTaxRegistered: false,
        })
        .returning();
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          stateCode: CONTACT_STATE.ACTIVE,
          firstName: 'John',
          lastName: 'Doe',
        })
        .returning();

      await service.addContact(
        actor.actorId,
        {
          contactId: contact.contactId,
          primaryFor: ['billing'],
        },
        mockUserId,
      );

      const dbLinks = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.actorId, actor.actorId),
      });
      expect(dbLinks.length).toBe(1);
      expect(dbLinks[0].primaryFor).toEqual(['billing']);

      await service.updateContact(
        actor.actorId,
        contact.contactId,
        {
          primaryFor: ['billing', 'shipping'],
        },
        mockUserId,
      );

      const updatedLinks = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.actorId, actor.actorId),
      });
      expect(updatedLinks[0].primaryFor).toEqual(['billing', 'shipping']);

      await service.removeContact(actor.actorId, contact.contactId, mockUserId);

      const finalLinks = await pg.db.query.actorContactLinks.findMany({
        where: eq(actorContactLinks.actorId, actor.actorId),
      });
      expect(finalLinks.length).toBe(0);
    });
  });

  describe('actorActorLinks', () => {
    it('should add, get, and remove actor links', async () => {
      const [actorA] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Parent Corp',
          industry: 'Finance',
          isTaxRegistered: false,
        })
        .returning();

      const [actorB] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Subsidiary Inc',
          industry: 'Tech',
          isTaxRegistered: false,
        })
        .returning();

      // Add link
      const link = await service.addActorLink(
        actorA.actorId,
        {
          targetActorId: actorB.actorId,
          linkType: 'subsidiary',
        },
        mockUserId,
      );

      expect(link).toBeDefined();
      expect(link.sourceActorId).toBe(actorA.actorId);
      expect(link.targetActorId).toBe(actorB.actorId);
      expect(link.linkType).toBe('subsidiary');
      expect(link.targetActor?.name).toBe('Subsidiary Inc');

      // Get links from Actor A's perspective
      const linksA = await service.getActorLinks(actorA.actorId);
      expect(linksA.length).toBe(1);
      expect(linksA[0].linkId).toBe(link.linkId);

      // Get links from Actor B's perspective (it was target)
      const linksB = await service.getActorLinks(actorB.actorId);
      expect(linksB.length).toBe(1);
      expect(linksB[0].linkId).toBe(link.linkId);
      expect(linksB[0].sourceActor?.name).toBe('Parent Corp');

      // Remove link
      await service.removeActorLink(actorA.actorId, link.linkId, mockUserId);

      const linksAfter = await service.getActorLinks(actorA.actorId);
      expect(linksAfter.length).toBe(0);
    });

    it('should disallow linking an actor to itself', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Solo Corp',
          isTaxRegistered: false,
        })
        .returning();

      await expect(
        service.addActorLink(
          actor.actorId,
          {
            targetActorId: actor.actorId,
            linkType: 'subsidiary',
          },
          mockUserId,
        ),
      ).rejects.toThrow('Cannot link an actor to itself');
    });
  });

  describe('getActors', () => {
    it('should filter actors by ownerId and return ownerDisplayName', async () => {
      const [assignedActor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Assigned Actor',
          isTaxRegistered: false,
          ownerId: mockUserId,
        })
        .returning();

      const [unassignedActor] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Unassigned Actor',
          isTaxRegistered: false,
          ownerId: null,
        })
        .returning();

      // Filter by specific ownerId
      const ownerList = await service.getActors({ ownerId: mockUserId });
      expect(
        ownerList.data.some((a) => a.actorId === assignedActor.actorId),
      ).toBe(true);
      expect(
        ownerList.data.some((a) => a.actorId === unassignedActor.actorId),
      ).toBe(false);

      const found = ownerList.data.find(
        (a) => a.actorId === assignedActor.actorId,
      );
      expect(found?.ownerDisplayName).toBe('Mock User');

      // Filter by unassigned
      const unassignedList = await service.getActors({ ownerId: 'unassigned' });
      expect(
        unassignedList.data.some((a) => a.actorId === unassignedActor.actorId),
      ).toBe(true);
      expect(
        unassignedList.data.some((a) => a.actorId === assignedActor.actorId),
      ).toBe(false);
    });
  });
});
