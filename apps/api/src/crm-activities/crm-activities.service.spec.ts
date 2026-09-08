import { Test, TestingModule } from '@nestjs/testing';
import { CrmActivitiesService } from './crm-activities.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  crmActivities,
  crmActivityContacts,
  organizations,
  contacts,
  opportunities,
  opportunityContacts,
  users,
} from '@herobm/db-schema';
import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { emitEvent } from '../common/emit-event';
import {
  ORGANIZATION_STATE,
  CONTACT_STATE,
  OPPORTUNITY_STATE,
} from '@herobm/shared';

jest.mock('../common/emit-event', () => ({
  emitEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('CrmActivitiesService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: CrmActivitiesService;
  const mockUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    role: 'admin',
  };

  beforeEach(async () => {
    await pg.db.delete(crmActivityContacts);
    await pg.db.delete(crmActivities);
    await pg.db.delete(opportunityContacts);
    await pg.db.delete(opportunities);
    await pg.db.delete(contacts);
    await pg.db.delete(organizations);
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
    it('should create a call activity linked to an organization', async () => {
      const [org] = await pg.db
        .insert(organizations)
        .values({
          name: 'Acme Corp',
          stateCode: ORGANIZATION_STATE.ACTIVE,
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
          organizationId: org.organizationId,
        },
        mockUser,
      );

      expect(result).toBeDefined();
      expect(result.activityId).toBeDefined();
      expect(result.type).toBe('call');
      expect(result.subject).toBe('Initial discovery call');
      expect(result.organizationName).toBe('Acme Corp');
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

    it('should create an activity with a custom configurable type', async () => {
      const result = await service.create(
        {
          type: 'demo',
          subject: 'Product Demo Session',
          status: 'completed',
          priority: 'high',
        },
        mockUser,
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('demo');
      expect(result.subject).toBe('Product Demo Session');
    });
  });

  describe('findAll', () => {
    it('should filter activities by organizationId', async () => {
      const [org1] = await pg.db
        .insert(organizations)
        .values({
          name: 'Org 1',
          stateCode: ORGANIZATION_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const [org2] = await pg.db
        .insert(organizations)
        .values({
          name: 'Org 2',
          stateCode: ORGANIZATION_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      await service.create(
        {
          type: 'call',
          subject: 'Call for Org 1',
          status: 'completed',
          priority: 'low',
          organizationId: org1.organizationId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'meeting',
          subject: 'Meeting for Org 2',
          status: 'completed',
          priority: 'medium',
          organizationId: org2.organizationId,
        },
        mockUser,
      );

      const res = await service.findAll({
        organizationId: org1.organizationId,
      });
      expect(res.data.length).toBe(1);
      expect(res.data[0].subject).toBe('Call for Org 1');
      expect(res.data[0].organizationName).toBe('Org 1');
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

    it('should filter by isOverdue', async () => {
      const pastDate = new Date(Date.now() - 86400000 * 2).toISOString();
      const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();

      await service.create(
        {
          type: 'task',
          subject: 'Overdue task',
          status: 'open',
          priority: 'high',
          dueDate: pastDate,
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'task',
          subject: 'Future task',
          status: 'open',
          priority: 'medium',
          dueDate: futureDate,
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'task',
          subject: 'Completed overdue task',
          status: 'completed',
          priority: 'low',
          dueDate: pastDate,
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      const overdueRes = await service.findAll(
        { isOverdue: 'true' },
        mockUser.userId,
      );
      expect(overdueRes.data.length).toBe(1);
      expect(overdueRes.data[0].subject).toBe('Overdue task');
    });

    it('should filter by dueDateFrom and dueDateTo', async () => {
      await service.create(
        {
          type: 'task',
          subject: 'Task in range',
          status: 'open',
          priority: 'medium',
          dueDate: '2026-06-15T10:00:00Z',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      await service.create(
        {
          type: 'task',
          subject: 'Task outside range',
          status: 'open',
          priority: 'low',
          dueDate: '2026-08-01T10:00:00Z',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      const res = await service.findAll(
        {
          dueDateFrom: '2026-06-01T00:00:00Z',
          dueDateTo: '2026-06-30T23:59:59Z',
        },
        mockUser.userId,
      );
      expect(res.data.length).toBe(1);
      expect(res.data[0].subject).toBe('Task in range');
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

  describe('reopen', () => {
    it('should reopen a completed task and reset completion fields', async () => {
      const task = await service.create(
        {
          type: 'task',
          subject: 'Task to complete and reopen',
          status: 'open',
          priority: 'medium',
        },
        mockUser,
      );

      await service.complete(task.activityId, mockUser);
      const completed = await service.findOne(task.activityId, mockUser);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();

      const reopened = await service.reopen(task.activityId, mockUser);
      expect(reopened.status).toBe('open');
      expect(reopened.completedAt).toBeNull();
      expect(reopened.completedByUserId).toBeNull();

      const fetched = await service.findOne(task.activityId, mockUser);
      expect(fetched.status).toBe('open');
      expect(fetched.completedAt).toBeNull();
      expect(fetched.completedByUserId).toBeNull();
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

  describe('task privacy - opportunities public, standalone private', () => {
    const userAlice = {
      userId: '00000000-0000-0000-0000-000000000002',
      username: 'alice',
      role: 'sales',
    };
    const userBob = {
      userId: '00000000-0000-0000-0000-000000000003',
      username: 'bob',
      role: 'sales',
    };
    const userCharlie = {
      userId: '00000000-0000-0000-0000-000000000004',
      username: 'charlie',
      role: 'sales',
    };

    beforeEach(async () => {
      // Insert Alice, Bob, Charlie into users table
      await pg.db.insert(users).values([
        {
          userId: userAlice.userId,
          username: userAlice.username,
          displayName: 'Alice Sales',
          // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock user
          passwordHash: 'hash',
          role: userAlice.role,
          isActive: true,
        },
        {
          userId: userBob.userId,
          username: userBob.username,
          displayName: 'Bob Sales',
          // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock user
          passwordHash: 'hash',
          role: userBob.role,
          isActive: true,
        },
        {
          userId: userCharlie.userId,
          username: userCharlie.username,
          displayName: 'Charlie Sales',
          // eslint-disable-next-line no-restricted-syntax -- ADV-024: TEST_CREDENTIAL mock user
          passwordHash: 'hash',
          role: userCharlie.role,
          isActive: true,
        },
      ]);
    });

    it('tasks attached to opportunities are public across all users', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Big Deal',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Discovery',
          type: 'New Business',
        })
        .returning();

      const oppTask = await service.create(
        {
          type: 'task',
          subject: 'Review pricing with client',
          status: 'open',
          priority: 'high',
          opportunityId: opp.opportunityId,
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Alice can see it
      const aliceList = await service.findAll({ type: 'task' }, userAlice);
      expect(aliceList.data.map((t) => t.activityId)).toContain(
        oppTask.activityId,
      );

      // Bob can see it
      const bobList = await service.findAll({ type: 'task' }, userBob);
      expect(bobList.data.map((t) => t.activityId)).toContain(
        oppTask.activityId,
      );

      // Bob can fetch it via findOne
      const bobFetched = await service.findOne(oppTask.activityId, userBob);
      expect(bobFetched.activityId).toBe(oppTask.activityId);
    });

    it('tasks NOT attached to opportunities are private to assignee and creator', async () => {
      // Alice creates a private standalone task assigned to herself
      const aliceTask = await service.create(
        {
          type: 'task',
          subject: 'Alice personal task',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Alice creates a private standalone task assigned to Bob
      const delegatedTask = await service.create(
        {
          type: 'task',
          subject: 'Task assigned to Bob by Alice',
          status: 'open',
          priority: 'urgent',
          assignedToUserId: userBob.userId,
        },
        userAlice,
      );

      // Alice views tasks
      const aliceList = await service.findAll({ type: 'task' }, userAlice);
      const aliceIds = aliceList.data.map((t) => t.activityId);
      expect(aliceIds).toContain(aliceTask.activityId); // Alice is assignee & creator
      expect(aliceIds).toContain(delegatedTask.activityId); // Alice is creator

      // Bob views tasks
      const bobList = await service.findAll({ type: 'task' }, userBob);
      const bobIds = bobList.data.map((t) => t.activityId);
      expect(bobIds).not.toContain(aliceTask.activityId); // Alice's task is hidden from Bob
      expect(bobIds).toContain(delegatedTask.activityId); // Bob is assignee

      // Charlie views tasks
      const charlieList = await service.findAll({ type: 'task' }, userCharlie);
      const charlieIds = charlieList.data.map((t) => t.activityId);
      expect(charlieIds).not.toContain(aliceTask.activityId);
      expect(charlieIds).not.toContain(delegatedTask.activityId);

      // Admin views tasks
      const adminList = await service.findAll({ type: 'task' }, mockUser);
      const adminIds = adminList.data.map((t) => t.activityId);
      expect(adminIds).toContain(aliceTask.activityId);
      expect(adminIds).toContain(delegatedTask.activityId);

      // findOne checks
      await expect(
        service.findOne(aliceTask.activityId, userBob),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findOne(aliceTask.activityId, userCharlie),
      ).rejects.toThrow(NotFoundException);
      const fetchedByAlice = await service.findOne(
        aliceTask.activityId,
        userAlice,
      );
      expect(fetchedByAlice.activityId).toBe(aliceTask.activityId);

      const fetchedByAdmin = await service.findOne(
        aliceTask.activityId,
        mockUser,
      );
      expect(fetchedByAdmin.activityId).toBe(aliceTask.activityId);
    });

    it('prevents unauthorized users from updating, completing, or deleting private tasks', async () => {
      const privateTask = await service.create(
        {
          type: 'task',
          subject: 'Confidential follow-up',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Bob cannot update
      await expect(
        service.update(
          privateTask.activityId,
          { subject: 'Tampered' },
          userBob,
        ),
      ).rejects.toThrow(NotFoundException);

      // Bob cannot complete
      await expect(
        service.complete(privateTask.activityId, userBob),
      ).rejects.toThrow(NotFoundException);

      // Bob cannot delete
      await expect(
        service.remove(privateTask.activityId, userBob),
      ).rejects.toThrow(NotFoundException);

      // Alice can complete
      const completed = await service.complete(
        privateTask.activityId,
        userAlice,
      );
      expect(completed.status).toBe('completed');
    });

    it('non-task activities (call, note) without an opportunity remain public', async () => {
      const call = await service.create(
        {
          type: 'call',
          subject: 'General customer check-in',
          status: 'completed',
          priority: 'low',
        },
        userAlice,
      );

      // Bob can find it in findAll
      const bobList = await service.findAll({ type: 'call' }, userBob);
      expect(bobList.data.map((a) => a.activityId)).toContain(call.activityId);

      // Bob can findOne
      const fetched = await service.findOne(call.activityId, userBob);
      expect(fetched.activityId).toBe(call.activityId);
    });

    it('defaults assignedToUserId to creator when creating a private task without an assignee', async () => {
      const task = await service.create(
        {
          type: 'task',
          subject: 'Quick reminder to self',
          status: 'open',
          priority: 'low',
        },
        userAlice,
      );

      expect(task.assignedToUserId).toBe(userAlice.userId);
      expect(task.createdById).toBe(userAlice.userId);

      // Alice can fetch it
      const fetched = await service.findOne(task.activityId, userAlice);
      expect(fetched.activityId).toBe(task.activityId);

      // Bob cannot fetch it
      await expect(service.findOne(task.activityId, userBob)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filtering by assignedToUserId of another user returns their opportunity tasks but hides their private tasks', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Enterprise Contract',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Discovery',
          type: 'New Business',
        })
        .returning();

      // Alice has 1 opportunity task
      const aliceOppTask = await service.create(
        {
          type: 'task',
          subject: 'Alice deal follow-up',
          status: 'open',
          priority: 'high',
          opportunityId: opp.opportunityId,
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Alice has 1 private task
      const alicePrivateTask = await service.create(
        {
          type: 'task',
          subject: 'Alice secret follow-up',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Bob specifically queries for Alice's tasks: GET /crm-activities?assignedToUserId=alice&type=task
      const bobQuery = await service.findAll(
        { assignedToUserId: userAlice.userId, type: 'task' },
        userBob,
      );

      const returnedIds = bobQuery.data.map((t) => t.activityId);
      expect(returnedIds).toContain(aliceOppTask.activityId); // Should have access to public deal task
      expect(returnedIds).not.toContain(alicePrivateTask.activityId); // Should NOT have access to private task
    });

    it('querying "all open tasks" returns public opportunity tasks and own private tasks, hiding others private tasks', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Open Deal',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Discovery',
          type: 'New Business',
        })
        .returning();

      // Public open opportunity task
      const publicOpenTask = await service.create(
        {
          type: 'task',
          subject: 'Public open deal action',
          status: 'open',
          priority: 'high',
          opportunityId: opp.opportunityId,
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Alice's private open task
      const aliceOpenPrivate = await service.create(
        {
          type: 'task',
          subject: 'Alice open personal note',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Bob's private open task
      const bobOpenPrivate = await service.create(
        {
          type: 'task',
          subject: 'Bob open personal note',
          status: 'open',
          priority: 'urgent',
          assignedToUserId: userBob.userId,
        },
        userBob,
      );

      // Charlie's private open task
      const charlieOpenPrivate = await service.create(
        {
          type: 'task',
          subject: 'Charlie open personal note',
          status: 'open',
          priority: 'low',
          assignedToUserId: userCharlie.userId,
        },
        userCharlie,
      );

      // Bob fetches "all open tasks"
      const bobResult = await service.findAll(
        { type: 'task', status: 'open' },
        userBob,
      );
      const bobTaskIds = bobResult.data.map((t) => t.activityId);

      // Bob SHOULD see: public opportunity task + Bob's own private task
      expect(bobTaskIds).toContain(publicOpenTask.activityId);
      expect(bobTaskIds).toContain(bobOpenPrivate.activityId);

      // Bob SHOULD NOT see: Alice's or Charlie's private tasks
      expect(bobTaskIds).not.toContain(aliceOpenPrivate.activityId);
      expect(bobTaskIds).not.toContain(charlieOpenPrivate.activityId);
    });

    it('unauthenticated / anonymous requests cannot view private tasks', async () => {
      const privateTask = await service.create(
        {
          type: 'task',
          subject: 'Confidential without user',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // findAll without user context hides private tasks
      const anonymousList = await service.findAll({ type: 'task' });
      expect(anonymousList.data.map((t) => t.activityId)).not.toContain(
        privateTask.activityId,
      );

      // findOne without user context throws NotFoundException
      await expect(service.findOne(privateTask.activityId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creator can modify delegated private tasks, but uninvolved third parties cannot', async () => {
      // Alice creates a private task delegated to Bob
      const delegated = await service.create(
        {
          type: 'task',
          subject: 'Delegated task from Alice to Bob',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userBob.userId,
        },
        userAlice,
      );

      // Creator Alice can update it
      const updatedByAlice = await service.update(
        delegated.activityId,
        { subject: 'Updated by Alice creator' },
        userAlice,
      );
      expect(updatedByAlice.subject).toBe('Updated by Alice creator');

      // Uninvolved Charlie CANNOT update it
      await expect(
        service.update(
          delegated.activityId,
          { subject: 'Hacked by Charlie' },
          userCharlie,
        ),
      ).rejects.toThrow(NotFoundException);

      // Uninvolved Charlie CANNOT complete it
      await expect(
        service.complete(delegated.activityId, userCharlie),
      ).rejects.toThrow(NotFoundException);

      // Uninvolved Charlie CANNOT delete it
      await expect(
        service.remove(delegated.activityId, userCharlie),
      ).rejects.toThrow(NotFoundException);
    });

    it('dynamically transitioning a task to or from an opportunity alters its visibility immediately', async () => {
      const [opp] = await pg.db
        .insert(opportunities)
        .values({
          name: 'Dynamic Deal',
          stateCode: OPPORTUNITY_STATE.ACTIVE,
          status: 'Discovery',
          type: 'New Business',
        })
        .returning();

      // Start as private task
      const task = await service.create(
        {
          type: 'task',
          subject: 'Initially private task',
          status: 'open',
          priority: 'medium',
          assignedToUserId: userAlice.userId,
        },
        userAlice,
      );

      // Bob cannot see it initially
      await expect(service.findOne(task.activityId, userBob)).rejects.toThrow(
        NotFoundException,
      );

      // Alice attaches it to the opportunity -> now public
      await service.update(
        task.activityId,
        { opportunityId: opp.opportunityId },
        userAlice,
      );

      // Bob CAN now see it
      const bobFetched = await service.findOne(task.activityId, userBob);
      expect(bobFetched.activityId).toBe(task.activityId);

      // Alice detaches it from the opportunity -> now private again
      await service.update(task.activityId, { opportunityId: null }, userAlice);

      // Bob can NO LONGER see it
      await expect(service.findOne(task.activityId, userBob)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll ordering', () => {
    it('orders tasks by due date soonest first and puts tasks without due date last when myTasks is true', async () => {
      // Create 3 tasks with different due dates
      const taskLater = await service.create(
        {
          type: 'task',
          subject: 'Task Due Later',
          status: 'open',
          priority: 'medium',
          dueDate: '2026-10-15T12:00:00Z',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      const taskNoDue = await service.create(
        {
          type: 'task',
          subject: 'Task Without Due Date',
          status: 'open',
          priority: 'low',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      const taskSoonest = await service.create(
        {
          type: 'task',
          subject: 'Task Due Tomorrow',
          status: 'open',
          priority: 'urgent',
          dueDate: '2026-09-08T12:00:00Z',
          assignedToUserId: mockUser.userId,
        },
        mockUser,
      );

      const res = await service.findAll(
        { myTasks: 'true', status: 'open' },
        mockUser,
      );

      expect(res.data.map((t) => t.subject)).toEqual([
        'Task Due Tomorrow',
        'Task Due Later',
        'Task Without Due Date',
      ]);
    });
  });
});
