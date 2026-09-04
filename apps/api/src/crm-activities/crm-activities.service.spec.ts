import { Test, TestingModule } from '@nestjs/testing';
import { CrmActivitiesService } from './crm-activities.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  crmActivities,
  crmActivityContacts,
  actors,
  contacts,
  opportunities,
  opportunityContacts,
  users,
} from '@herobm/db-schema';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { emitEvent } from '../common/emit-event';
import { ACTOR_STATE, CONTACT_STATE, OPPORTUNITY_STATE } from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('CrmActivitiesService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: CrmActivitiesService;
  const mockUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
  };

  beforeEach(async () => {
    await pg.db.delete(crmActivityContacts);
    await pg.db.delete(crmActivities);
    await pg.db.delete(opportunityContacts);
    await pg.db.delete(opportunities);
    await pg.db.delete(contacts);
    await pg.db.delete(actors);
    await pg.db.delete(users);
    jest.clearAllMocks();

    // Create a mock user in users table
    await pg.db.insert(users).values({
      userId: mockUser.userId,
      username: mockUser.username,
      displayName: 'Admin User',
      // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock user
      passwordHash: 'hash',
      role: 'admin',
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [CrmActivitiesService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<CrmActivitiesService>(CrmActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a call activity linked to an actor', async () => {
      const [actor] = await pg.db
        .insert(actors)
        .values({
          name: 'Acme Corp',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const result = await service.create(
        {
          type: 'call',
          subject: 'Initial discovery call',
          description: 'Discussed Q3 requirements',
          status: 'completed',
          priority: 'medium',
          actorId: actor.actorId,
        },
        mockUser,
      );

      expect(result).toBeDefined();
      expect(result.activityId).toBeDefined();
      expect(result.type).toBe('call');
      expect(result.subject).toBe('Initial discovery call');
      expect(result.actorName).toBe('Acme Corp');
      expect(result.createdBy).toBe('admin');
      expect(emitEvent).toHaveBeenCalled();
    });

    it('should create a follow-up task with due date and assignee', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();

      const result = await service.create(
        {
          type: 'task',
          subject: 'Follow up with Sarah on pricing',
          description: 'Send revised quote after discount review',
          status: 'open',
          priority: 'high',
          dueDate,
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('task');
      expect(result.priority).toBe('high');
      expect(result.status).toBe('open');
      expect(result.assignedToUserId).toBe(mockUser.userId);
      expect(result.assignedToName).toBe('Admin User');
    });
  });

  describe('findAll', () => {
    it('should filter activities by actorId', async () => {
      const [actor1] = await pg.db
        .insert(actors)
        .values({
          name: 'Actor 1',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const [actor2] = await pg.db
        .insert(actors)
        .values({
          name: 'Actor 2',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      await service.create(
        {
          type: 'call',
          subject: 'Call for Actor 1',
          status: 'completed',
          priority: 'low',
          actorId: actor1.actorId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'meeting',
          subject: 'Meeting for Actor 2',
          status: 'completed',
          priority: 'medium',
          actorId: actor2.actorId,
        },
        mockUser,
      );

      const res = await service.findAll({ actorId: actor1.actorId });
      expect(res.data.length).toBe(1);
      expect(res.data[0].subject).toBe('Call for Actor 1');
      expect(res.data[0].actorName).toBe('Actor 1');
    });

    it('should filter by myTasks', async () => {
      await service.create(
        {
          type: 'task',
          subject: 'My task 1',
          status: 'open',
          priority: 'urgent',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'call',
          subject: 'Call by someone else',
          status: 'completed',
          priority: 'low',
        },
        mockUser,
      );

      const res = await service.findAll({ myTasks: 'true' }, mockUser.userId);
      expect(res.data.length).toBe(1);
      expect(res.data[0].subject).toBe('My task 1');
    });
  });

  describe('complete', () => {
    it('should mark a task as completed', async () => {
      const task = await service.create(
        {
          type: 'task',
          subject: 'Task to finish',
          status: 'open',
          priority: 'medium',
        },
        mockUser,
      );

      expect(task.status).toBe('open');
      expect(task.completedAt).toBeNull();

      const completed = await service.complete(task.activityId, mockUser);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.completedByUserId).toBe(mockUser.userId);
    });
  });

  describe('update & remove', () => {
    it('should update an activity', async () => {
      const created = await service.create(
        {
          type: 'meeting',
          subject: 'Strategy sync',
          status: 'scheduled',
          priority: 'medium',
        },
        mockUser,
      );

      const updated = await service.update(
        created.activityId,
        {
          subject: 'Strategy sync - rescheduled',
          priority: 'high',
        },
        mockUser,
      );

      expect(updated.subject).toBe('Strategy sync - rescheduled');
      expect(updated.priority).toBe('high');
    });

    it('should delete an activity and cascade attached contacts', async () => {
      const [contact] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Jane',
          lastName: 'Doe',
          fullName: 'Jane Doe',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const created = await service.create(
        {
          type: 'note',
          subject: 'Quick note',
          status: 'open',
          priority: 'low',
          contactIds: [contact.contactId],
        },
        mockUser,
      );

      const res = await service.remove(created.activityId, mockUser);
      expect(res.success).toBe(true);

      await expect(service.findOne(created.activityId)).rejects.toThrow(
        NotFoundException,
      );

      const remainingLinks = await pg.db
        .select()
        .from(crmActivityContacts)
        .where(eq(crmActivityContacts.activityId, created.activityId));
      expect(remainingLinks).toHaveLength(0);
    });
  });

  describe('multi-contact support', () => {
    it('should create an activity with multiple attached contacts and return them', async () => {
      const [c1] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Alice',
          lastName: 'Smith',
          fullName: 'Alice Smith',
          email: 'alice@example.com',
          jobTitle: 'VP Sales',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const [c2] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Bob',
          lastName: 'Jones',
          fullName: 'Bob Jones',
          email: 'bob@example.com',
          jobTitle: 'CTO',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const created = await service.create(
        {
          type: 'meeting',
          subject: 'Executive briefing',
          status: 'completed',
          priority: 'high',
          contactIds: [c1.contactId, c2.contactId],
        },
        mockUser,
      );

      expect(created.contacts).toHaveLength(2);
      const names = created.contacts?.map((c) => c.fullName).sort();
      expect(names).toEqual(['Alice Smith', 'Bob Jones']);

      // findOne also returns contacts
      const fetched = await service.findOne(created.activityId);
      expect(fetched.contacts).toHaveLength(2);

      // findAll returns contacts
      const list = await service.findAll();
      expect(list.data[0].contacts).toHaveLength(2);
    });

    it('should filter activities by contactId using junction table', async () => {
      const [c1] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Alice',
          lastName: 'Smith',
          fullName: 'Alice Smith',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const [c2] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Bob',
          lastName: 'Jones',
          fullName: 'Bob Jones',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      await service.create(
        {
          type: 'call',
          subject: 'Call with Alice',
          status: 'completed',
          priority: 'low',
          contactIds: [c1.contactId],
        },
        mockUser,
      );

      await service.create(
        {
          type: 'call',
          subject: 'Call with Bob',
          status: 'completed',
          priority: 'low',
          contactIds: [c2.contactId],
        },
        mockUser,
      );

      const aliceRes = await service.findAll({ contactId: c1.contactId });
      expect(aliceRes.data).toHaveLength(1);
      expect(aliceRes.data[0].subject).toBe('Call with Alice');

      const bobRes = await service.findAll({ contactId: c2.contactId });
      expect(bobRes.data).toHaveLength(1);
      expect(bobRes.data[0].subject).toBe('Call with Bob');
    });

    it('should update attached contacts', async () => {
      const [c1] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Alice',
          lastName: 'Smith',
          fullName: 'Alice Smith',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const [c2] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Bob',
          lastName: 'Jones',
          fullName: 'Bob Jones',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const created = await service.create(
        {
          type: 'meeting',
          subject: 'Initial meeting',
          status: 'open',
          priority: 'medium',
          contactIds: [c1.contactId],
        },
        mockUser,
      );

      expect(created.contacts).toHaveLength(1);
      expect(created.contacts?.[0].contactId).toBe(c1.contactId);

      // Update to replace with c2
      const updated = await service.update(
        created.activityId,
        {
          contactIds: [c2.contactId],
        },
        mockUser,
      );

      expect(updated.contacts).toHaveLength(1);
      expect(updated.contacts?.[0].contactId).toBe(c2.contactId);
    });

    it('should automatically add activity contacts to Opportunity contacts list when activity is logged for an opportunity', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Big Enterprise Deal',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Qualification',
          type: 'New Business',
        })
        .returning();

      const [c1] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Sarah',
          lastName: 'Connor',
          fullName: 'Sarah Connor',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      const [c2] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'John',
          lastName: 'Connor',
          fullName: 'John Connor',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      // Pre-link c1 to the opportunity
      await pg.db.insert(opportunityContacts).values({
        opportunityId: opp.opportunityId,
        contactId: c1.contactId,
        roles: ['sponsor'],
      });

      // Create activity linking both c1 and c2 to the opportunity
      await service.create(
        {
          type: 'meeting',
          subject: 'Technical demonstration',
          status: 'completed',
          priority: 'high',
          opportunityId: opp.opportunityId,
          contactIds: [c1.contactId, c2.contactId],
        },
        mockUser,
      );

      // Verify that opportunityContacts now contains both c1 and c2, without duplicate for c1
      const linked = await pg.db
        .select()
        .from(opportunityContacts)
        .where(eq(opportunityContacts.opportunityId, opp.opportunityId));

      expect(linked).toHaveLength(2);
      const linkedContactIds = linked.map((l) => l.contactId).sort();
      expect(linkedContactIds).toEqual([c1.contactId, c2.contactId].sort());
    });

    it('should automatically add contacts to Opportunity contacts list when updating an activity with contacts', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Expansion Project',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Discovery',
          type: 'Expansion',
        })
        .returning();

      const [contact] = await pg.db
        .insert(contacts)
        .values({
          firstName: 'Kyle',
          lastName: 'Reese',
          fullName: 'Kyle Reese',
          stateCode: CONTACT_STATE.ACTIVE,
        })
        .returning();

      // Create activity on opportunity without contacts initially
      const created = await service.create(
        {
          type: 'call',
          subject: 'Introductory call',
          status: 'completed',
          priority: 'medium',
          opportunityId: opp.opportunityId,
        },
        mockUser,
      );

      // Verify no contacts on opportunity yet
      let linked = await pg.db
        .select()
        .from(opportunityContacts)
        .where(eq(opportunityContacts.opportunityId, opp.opportunityId));
      expect(linked).toHaveLength(0);

      // Update activity to attach contact
      await service.update(
        created.activityId,
        {
          contactIds: [contact.contactId],
        },
        mockUser,
      );

      // Verify contact was auto-added to the opportunity contacts list
      linked = await pg.db
        .select()
        .from(opportunityContacts)
        .where(eq(opportunityContacts.opportunityId, opp.opportunityId));
      expect(linked).toHaveLength(1);
      expect(linked[0].contactId).toBe(contact.contactId);
    });
  });
});
