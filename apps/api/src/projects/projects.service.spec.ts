import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  projects,
  projectNotes,
  projectContacts,
  projectActors,
  contacts,
  actors,
  users,
} from '../drizzle/schema';
import { NotFoundException } from '@nestjs/common';
import { emitEvent } from '../common/emit-event';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { PROJECT_STATE } from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('ProjectsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ProjectsService;
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(projectActors);
    await pg.db.delete(projectContacts);
    await pg.db.delete(projectNotes);
    await pg.db.delete(projects);
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
      providers: [ProjectsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProject', () => {
    it('should create a project', async () => {
      const result = await service.createProject(
        {
          name: 'Test Project',
          status: PROJECT_STATE.ACTIVE,
          type: 'internal',
        },
        mockUserId,
      );

      expect(result.projectId).toBeDefined();
      expect(result.name).toBe('Test Project');
      expect(result.status).toBe(PROJECT_STATE.ACTIVE);
      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.projects.findFirst({
        where: eq(projects.projectId, result.projectId),
      });
      expect(dbRecord).toBeDefined();
    });
  });

  describe('updateProject', () => {
    it('should update a project', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({ name: 'Old', type: 'internal', status: PROJECT_STATE.ACTIVE })
        .returning();

      const result = await service.updateProject(
        project.projectId,
        {
          name: 'New',
        },
        mockUserId,
      );

      expect(result.name).toBe('New');
      expect(emitEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project to update does not exist', async () => {
      await expect(
        service.updateProject(randomUUID(), {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProject / getProjects', () => {
    it('should get all projects', async () => {
      await pg.db.insert(projects).values({
        name: 'Test',
        type: 'internal',
        status: PROJECT_STATE.ACTIVE,
      });
      const results = await service.getProjects();
      expect(results.data.length).toBe(1);
    });

    it('should get project by id', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Test',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();
      const result = await service.getProject(project.projectId);
      expect(result.projectId).toBe(project.projectId);
    });

    it('should throw NotFoundException if project not found by id', async () => {
      await expect(service.getProject(randomUUID())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sub-entities', () => {
    it('should add and remove a note', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Project',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();

      const noteResult = await service.addNote(
        project.projectId,
        { content: 'My Note' },
        mockUserId,
      );

      expect(noteResult.noteId).toBeDefined();
      expect(emitEvent).toHaveBeenCalled();

      await service.removeNote(
        project.projectId,
        noteResult.noteId,
        mockUserId,
      );

      const dbNotes = await pg.db.query.projectNotes.findMany({
        where: eq(projectNotes.projectId, project.projectId),
      });
      expect(dbNotes.length).toBe(0);
    });

    it('should add, update, and remove a contact', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Project',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();
      const [contact] = await pg.db
        .insert(contacts)
        .values({ firstName: 'John' })
        .returning();

      await service.addContact(
        project.projectId,
        {
          contactId: contact.contactId,
          roles: ['manager'],
        },
        mockUserId,
      );
      expect(emitEvent).toHaveBeenCalled();

      await service.updateContact(
        project.projectId,
        contact.contactId,
        {
          roles: ['sponsor'],
        },
        mockUserId,
      );

      const updatedLinks = await pg.db.query.projectContacts.findMany({
        where: eq(projectContacts.projectId, project.projectId),
      });
      expect(updatedLinks[0].roles).toEqual(['sponsor']);

      await service.removeContact(
        project.projectId,
        contact.contactId,
        mockUserId,
      );
    });

    it('should add and remove an actor', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Project',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();
      const [actor] = await pg.db
        .insert(actors)
        .values({ name: 'Actor', isTaxRegistered: false })
        .returning();

      await service.addActor(
        project.projectId,
        {
          actorId: actor.actorId,
          roles: ['supplier'],
        },
        mockUserId,
      );
      expect(emitEvent).toHaveBeenCalled();

      const links = await pg.db.query.projectActors.findMany({
        where: eq(projectActors.projectId, project.projectId),
      });
      expect(links.length).toBe(1);

      await service.removeActor(project.projectId, actor.actorId, mockUserId);
    });
  });

  describe('deleteProject', () => {
    it('should delete project', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Project',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();

      await service.deleteProject(project.projectId, mockUserId);
      expect(emitEvent).toHaveBeenCalled();

      const dbRecord = await pg.db.query.projects.findFirst({
        where: eq(projects.projectId, project.projectId),
      });
      expect(dbRecord).toBeUndefined();
    });

    it('should throw NotFoundException if project to delete does not exist', async () => {
      await expect(
        service.deleteProject(randomUUID(), mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('archiveProject', () => {
    it('should archive a project', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'To Archive',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
        })
        .returning();

      const res = await service.archiveProject(project.projectId, mockUserId);
      expect(res.stateCode).toBe(PROJECT_STATE.ARCHIVED);

      const dbRecord = await pg.db.query.projects.findFirst({
        where: eq(projects.projectId, project.projectId),
      });
      expect(dbRecord?.stateCode).toBe(PROJECT_STATE.ARCHIVED);
    });
  });

  describe('unarchiveProject', () => {
    it('should unarchive a project', async () => {
      const [project] = await pg.db
        .insert(projects)
        .values({
          name: 'Project To Unarchive',
          type: 'internal',
          status: PROJECT_STATE.ACTIVE,
          stateCode: PROJECT_STATE.ARCHIVED,
        })
        .returning();

      const res = await service.unarchiveProject(project.projectId, mockUserId);
      expect(res.stateCode).toBe(PROJECT_STATE.ACTIVE);

      const dbRecord = await pg.db.query.projects.findFirst({
        where: eq(projects.projectId, project.projectId),
      });
      expect(dbRecord?.stateCode).toBe(PROJECT_STATE.ACTIVE);
    });
  });
});
