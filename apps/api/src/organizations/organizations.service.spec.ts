import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from './organizations.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  organizations,
  organizationContactLinks,
  organizationOrganizationLinks,
  organizationNotes,
  contacts,
  users,
} from '@herobm/db-schema';
import { ORGANIZATION_STATE, CONTACT_STATE } from '@herobm/shared';
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

describe('OrganizationsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrganizationsService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(organizationOrganizationLinks);
    await pg.db.delete(organizationContactLinks);
    await pg.db.delete(organizationNotes);
    await pg.db.delete(organizations);
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
      providers: [OrganizationsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrganization', () => {
    it('should create an organization', async () => {
      const dto = {
        name: 'Test Organization',
        email: 'test@organization.com',
        phone: '1234567890',
      };

      const result = await service.createOrganization(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.organizationId).toBeDefined();
      expect(result.name).toBe('Test Organization');
      expect(result.email).toBe('test@organization.com');

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, result.organizationId),
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.name).toBe('Test Organization');
      expect(dbRecord?.isTaxRegistered).toBe(false);
    });

    it('should create an organization when isTaxRegistered is explicitly undefined', async () => {
      const dto = {
        name: 'Organization Without Tax Info',
        industry: 'Manufacturing',
        headquartersCountry: 'FR',
        email: 'org@testing.com',
        isTaxRegistered: undefined,
      };

      const result = await service.createOrganization(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.organizationId).toBeDefined();
      expect(result.name).toBe('Organization Without Tax Info');

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, result.organizationId),
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord?.isTaxRegistered).toBe(false);
    });

    it('should create an organization with an assigned ownerId', async () => {
      const dto = {
        name: 'Organization With Owner',
        ownerId: mockUserId,
      };

      const result = await service.createOrganization(dto, mockUserId);

      expect(result).toBeDefined();
      expect(result.ownerId).toBe(mockUserId);

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, result.organizationId),
      });

      expect(dbRecord?.ownerId).toBe(mockUserId);
    });
  });

  describe('getOrganization', () => {
    it('should return an organization by ID', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Existing Organization',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.getOrganization(org.organizationId);

      expect(result.organizationId).toBe(org.organizationId);
      expect(result.name).toBe('Existing Organization');
    });

    it('should return an organization by ID with populated owner details', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Existing Organization with Owner',
          isTaxRegistered: false,
          ownerId: mockUserId,
        })
        .returning();

      const result = await service.getOrganization(org.organizationId);

      expect(result.organizationId).toBe(org.organizationId);
      expect(result.ownerId).toBe(mockUserId);
      expect(result.owner).toBeDefined();
      expect(result.ownerDisplayName).toBe('Mock User');
    });

    it('should throw NotFoundException if organization not found', async () => {
      await expect(service.getOrganization(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update an existing organization', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Old Name',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.updateOrganization(
        org.organizationId,
        {
          name: 'New Name',
        },
        mockUserId,
      );

      expect(result.organizationId).toBe(org.organizationId);
      expect(result.name).toBe('New Name');

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, org.organizationId),
      });
      expect(dbRecord?.name).toBe('New Name');
    });

    it('should assign and clear an organization owner', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Organization to assign',
          isTaxRegistered: false,
        })
        .returning();

      const updated = await service.updateOrganization(
        org.organizationId,
        { ownerId: mockUserId },
        mockUserId,
      );
      expect(updated.ownerId).toBe(mockUserId);

      const unassigned = await service.updateOrganization(
        org.organizationId,
        { ownerId: null },
        mockUserId,
      );
      expect(unassigned.ownerId).toBeNull();
    });

    it('should throw NotFoundException if organization to update does not exist', async () => {
      await expect(
        service.updateOrganization(
          randomUUID(),
          { name: 'New Name' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteOrganization', () => {
    it('should delete an existing organization', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'To Delete',
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.deleteOrganization(
        org.organizationId,
        mockUserId,
      );
      expect(result.success).toBe(true);

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, org.organizationId),
      });
      expect(dbRecord).toBeUndefined();
    });

    it('should throw NotFoundException if organization to delete does not exist', async () => {
      await expect(
        service.deleteOrganization(randomUUID(), mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveOrganization', () => {
    it('should archive an organization', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'To Archive',
          isTaxRegistered: false,
        })
        .returning();

      const res = await service.archiveOrganization(
        org.organizationId,
        mockUserId,
      );
      expect(res.stateCode).toBe(ORGANIZATION_STATE.ARCHIVED);

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, org.organizationId),
      });
      expect(dbRecord?.stateCode).toBe(ORGANIZATION_STATE.ARCHIVED);
    });
  });

  describe('unarchiveOrganization', () => {
    it('should unarchive an organization', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          name: 'To Unarchive',
          stateCode: ORGANIZATION_STATE.ARCHIVED,
          isTaxRegistered: false,
        })
        .returning();

      const res = await service.unarchiveOrganization(
        org.organizationId,
        mockUserId,
      );
      expect(res.stateCode).toBe(ORGANIZATION_STATE.ACTIVE);

      const dbRecord = await pg.db.query.organizations.findFirst({
        where: eq(organizations.organizationId, org.organizationId),
      });
      expect(dbRecord?.stateCode).toBe(ORGANIZATION_STATE.ACTIVE);
    });
  });

  describe('sub-entities', () => {
    it('should add and remove a note', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Note Organization',
          isTaxRegistered: false,
        })
        .returning();

      const noteResult = await service.addNote(
        org.organizationId,
        { content: 'My Note' },
        mockUserId,
      );

      expect(noteResult.noteId).toBeDefined();
      expect(noteResult.content).toBe('My Note');

      const dbNotes = await pg.db.query.organizationNotes.findMany({
        where: eq(organizationNotes.organizationId, org.organizationId),
      });
      expect(dbNotes.length).toBe(1);

      await service.removeNote(
        org.organizationId,
        noteResult.noteId,
        mockUserId,
      );

      const dbNotesAfter = await pg.db.query.organizationNotes.findMany({
        where: eq(organizationNotes.organizationId, org.organizationId),
      });
      expect(dbNotesAfter.length).toBe(0);
    });

    it('should add, update, and remove a contact', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Contact Organization',
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
        org.organizationId,
        {
          contactId: contact.contactId,
          primaryFor: ['billing'],
        },
        mockUserId,
      );

      const dbLinks = await pg.db.query.organizationContactLinks.findMany({
        where: eq(organizationContactLinks.organizationId, org.organizationId),
      });
      expect(dbLinks.length).toBe(1);
      expect(dbLinks[0].primaryFor).toEqual(['billing']);

      await service.updateContact(
        org.organizationId,
        contact.contactId,
        {
          primaryFor: ['billing', 'shipping'],
        },
        mockUserId,
      );

      const updatedLinks = await pg.db.query.organizationContactLinks.findMany({
        where: eq(organizationContactLinks.organizationId, org.organizationId),
      });
      expect(updatedLinks[0].primaryFor).toEqual(['billing', 'shipping']);

      await service.removeContact(
        org.organizationId,
        contact.contactId,
        mockUserId,
      );

      const finalLinks = await pg.db.query.organizationContactLinks.findMany({
        where: eq(organizationContactLinks.organizationId, org.organizationId),
      });
      expect(finalLinks.length).toBe(0);
    });
  });

  describe('organizationOrganizationLinks', () => {
    it('should add, get, and remove organization links', async () => {
      const [orgA] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Parent Corp',
          industry: 'Finance',
          isTaxRegistered: false,
        })
        .returning();

      const [orgB] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Subsidiary Inc',
          industry: 'Tech',
          isTaxRegistered: false,
        })
        .returning();

      // Add link
      const link = await service.addOrganizationLink(
        orgA.organizationId,
        {
          targetOrganizationId: orgB.organizationId,
          linkType: 'subsidiary',
        },
        mockUserId,
      );

      expect(link).toBeDefined();
      expect(link.sourceOrganizationId).toBe(orgA.organizationId);
      expect(link.targetOrganizationId).toBe(orgB.organizationId);
      expect(link.linkType).toBe('subsidiary');
      expect(link.targetOrganization?.name).toBe('Subsidiary Inc');

      // Get links from Org A's perspective
      const linksA = await service.getOrganizationLinks(orgA.organizationId);
      expect(linksA.length).toBe(1);
      expect(linksA[0].linkId).toBe(link.linkId);

      // Get links from Org B's perspective (it was target)
      const linksB = await service.getOrganizationLinks(orgB.organizationId);
      expect(linksB.length).toBe(1);
      expect(linksB[0].linkId).toBe(link.linkId);
      expect(linksB[0].sourceOrganization?.name).toBe('Parent Corp');

      // Remove link
      await service.removeOrganizationLink(
        orgA.organizationId,
        link.linkId,
        mockUserId,
      );

      const linksAfter = await service.getOrganizationLinks(
        orgA.organizationId,
      );
      expect(linksAfter.length).toBe(0);
    });

    it('should disallow linking an organization to itself', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Solo Corp',
          isTaxRegistered: false,
        })
        .returning();

      await expect(
        service.addOrganizationLink(
          org.organizationId,
          {
            targetOrganizationId: org.organizationId,
            linkType: 'subsidiary',
          },
          mockUserId,
        ),
      ).rejects.toThrow('Cannot link an organization to itself');
    });
  });

  describe('getOrganizations', () => {
    it('should filter organizations by ownerId and return ownerDisplayName', async () => {
      const [assignedOrg] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Assigned Organization',
          isTaxRegistered: false,
          ownerId: mockUserId,
        })
        .returning();

      const [unassignedOrg] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Unassigned Organization',
          isTaxRegistered: false,
          ownerId: null,
        })
        .returning();

      // Filter by specific ownerId
      const ownerList = await service.getOrganizations({ ownerId: mockUserId });
      expect(
        ownerList.data.some(
          (a) => a.organizationId === assignedOrg.organizationId,
        ),
      ).toBe(true);
      expect(
        ownerList.data.some(
          (a) => a.organizationId === unassignedOrg.organizationId,
        ),
      ).toBe(false);

      const found = ownerList.data.find(
        (a) => a.organizationId === assignedOrg.organizationId,
      );
      expect(found?.ownerDisplayName).toBe('Mock User');

      // Filter by unassigned
      const unassignedList = await service.getOrganizations({
        ownerId: 'unassigned',
      });
      expect(
        unassignedList.data.some(
          (a) => a.organizationId === unassignedOrg.organizationId,
        ),
      ).toBe(true);
      expect(
        unassignedList.data.some(
          (a) => a.organizationId === assignedOrg.organizationId,
        ),
      ).toBe(false);
    });
  });
});
