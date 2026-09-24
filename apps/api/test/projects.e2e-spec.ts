import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  CUSTOMER_STATE,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
  PROJECT_LINE_TYPE,
  RESOURCE_TYPE,
  PROJECT_TASK_STATE,
} from '@herobm/shared';

describe('Projects & Job Costing (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let baseUrl: any;
  let customerId: string;
  let productId: string;
  let locationId: string;
  let binId: string;
  let createdProjectId: string;
  let createdTaskId: string;
  let createdResourceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    baseUrl = process.env.TEST_API_URL || app.getHttpServer();

    // 1. Admin login
    const adminRes = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    if (adminRes.status !== 201) {
      throw new Error(`Admin login failed: ${adminRes.status}`);
    }
    adminToken = adminRes.body.access_token;

    // 2. Viewer login
    const viewerRes = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });
    if (viewerRes.status !== 201) {
      throw new Error(`Viewer login failed: ${viewerRes.status}`);
    }
    viewerToken = viewerRes.body.access_token;

    // 3. Create dedicated customer
    const custRes = await request(baseUrl)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        billingAddressCountry: 'AU',
        customerNumber: `PRJ-CUST-${Date.now()}`,
        name: 'Project E2E Customer',
        currencyCode: 'AUD',
        creditLimit: '100000',
      });
    if (custRes.status !== 201) {
      throw new Error(
        `Customer creation failed: ${custRes.status} ${JSON.stringify(custRes.body)}`,
      );
    }
    customerId = custRes.body.customerId;

    // 4. Create product for materials testing
    const prodRes = await request(baseUrl)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `PRJ-MAT-${Date.now()}`,
        name: 'Fiber Optic Cable Drum',
        listPrice: '250.00',
        productType: 'inventory',
        baseUom: 'EA',
      });
    productId = prodRes.body.productId;

    // 5. Create location, zone, and bin for warehouse testing
    const locRes = await request(baseUrl)
      .post('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `PRJ-WH-${Date.now()}`,
        name: 'Projects Staging Warehouse',
        city: 'Melbourne',
      });
    locationId = locRes.body.locationId;

    const zoneRes = await request(baseUrl)
      .post('/api/inventory/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationId,
        code: 'STG',
        name: 'Staging Zone',
      });
    const zoneId = zoneRes.body.zoneId;

    const binRes = await request(baseUrl)
      .post('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        zoneId,
        binNumber: 'STG-01-A',
        binType: 'storage',
      });
    binId = binRes.body.binId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Project Creation & Querying', () => {
    it('POST /api/projects — creates a new project in draft state (admin)', async () => {
      const res = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Data Center Migration Phase 1',
          description: 'Full hardware and network overhaul',
          customerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
          startDate: '2026-10-01T00:00:00.000Z',
          targetEndDate: '2026-12-31T00:00:00.000Z',
          notes: 'Priority mission-critical rollout',
        });

      if (res.status !== 201) {
        throw new Error(
          `Create project failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(201);
      expect(res.body.projectId).toBeDefined();
      expect(res.body.name).toBe('Data Center Migration Phase 1');
      expect(res.body.stateCode).toBe(PROJECT_STATE.DRAFT);
      expect(res.body.customerId).toBe(customerId);
      createdProjectId = res.body.projectId;
    });

    it('GET /api/projects — returns list of projects with query filters (viewer)', async () => {
      // Test basic listing
      const res = await request(baseUrl)
        .get('/api/projects')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Test stateCode filter
      const draftRes = await request(baseUrl)
        .get(`/api/projects?stateCode=${PROJECT_STATE.DRAFT}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(draftRes.status).toBe(200);
      expect(
        draftRes.body.data.some((p: any) => p.projectId === createdProjectId),
      ).toBe(true);

      // Test status alias filter
      const statusAliasRes = await request(baseUrl)
        .get(`/api/projects?status=${PROJECT_STATE.DRAFT}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(statusAliasRes.status).toBe(200);
      expect(
        statusAliasRes.body.data.some(
          (p: any) => p.projectId === createdProjectId,
        ),
      ).toBe(true);
    });

    it('GET /api/projects/:id — returns project details with relations (viewer)', async () => {
      const res = await request(baseUrl)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(createdProjectId);
      expect(res.body.customer).toBeDefined();
      expect(res.body.customer.customerId).toBe(customerId);
    });

    it('PATCH /api/projects/:id — updates project header fields (admin)', async () => {
      const res = await request(baseUrl)
        .patch(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Data Center Migration Phase 1 - Enterprise Edition',
          notes: 'Updated project scope notes',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(
        'Data Center Migration Phase 1 - Enterprise Edition',
      );
      expect(res.body.notes).toBe('Updated project scope notes');
    });

    it('POST /api/projects — rejects creation with non-existent customer (400 or 404)', async () => {
      const res = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Customer Project',
          customerId: '00000000-0000-4000-8000-000000000000',
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        });

      expect([400, 404]).toContain(res.status);
    });

    it('POST /api/projects — rejects creation when stagingBinId is not a project bin (400)', async () => {
      const res = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Staging Bin Project',
          customerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
          stagingLocationId: locationId,
          stagingBinId: binId, // binId is 'storage' type, not 'project'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be of type.*project/i);
    });

    it('PATCH /api/projects/:id — returns 404 for non-existent project (404)', async () => {
      const res = await request(baseUrl)
        .patch('/api/projects/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Non Existent Project' });

      expect(res.status).toBe(404);
    });
  });

  describe('WBS Task Management', () => {
    it('POST /api/projects/:id/tasks — creates a WBS task (admin)', async () => {
      const res = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taskCode: '1.0',
          name: 'Site Preparation & Racking',
          description: 'Prepare server racks and power cabling',
          plannedHours: 40,
        });

      if (res.status !== 201) {
        throw new Error(
          `Create task failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(201);
      expect(res.body.projectTaskId).toBeDefined();
      expect(res.body.taskCode).toBe('1.0');
      expect(res.body.stateCode).toBe(PROJECT_TASK_STATE.NOT_STARTED);
      createdTaskId = res.body.projectTaskId;
    });

    it('GET /api/projects/:id — includes tasks in project details (viewer)', async () => {
      const res = await request(baseUrl)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(
        res.body.tasks.some((t: any) => t.projectTaskId === createdTaskId),
      ).toBe(true);
    });

    it('PATCH /api/projects/:id/tasks/:taskId — updates task state and progress (admin)', async () => {
      // Cannot start task on DRAFT project (400)
      const draftRes = await request(baseUrl)
        .patch(`/api/projects/${createdProjectId}/tasks/${createdTaskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
        });

      expect(draftRes.status).toBe(400);
      expect(draftRes.body.message).toContain(
        'Cannot start a task unless the project is active',
      );

      // Create an active project to verify task start
      const activePrjRes = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Active Project for Tasks',
          customerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        });
      expect(activePrjRes.status).toBe(201);
      const activePrjId = activePrjRes.body.projectId;

      await request(baseUrl)
        .post(`/api/projects/${activePrjId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: PROJECT_STATE.ACTIVE })
        .expect(200);

      const activeTaskRes = await request(baseUrl)
        .post(`/api/projects/${activePrjId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taskCode: '1.0',
          name: 'Active Task',
        })
        .expect(201);

      // Start task on ACTIVE project (200)
      const res = await request(baseUrl)
        .patch(
          `/api/projects/${activePrjId}/tasks/${activeTaskRes.body.projectTaskId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: PROJECT_TASK_STATE.IN_PROGRESS,
        });

      if (res.status !== 200) {
        throw new Error(
          `Update task failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(200);
      expect(res.body.stateCode).toBe(PROJECT_TASK_STATE.IN_PROGRESS);
    });

    it('POST /api/projects/:id/tasks — creates a hierarchical child subtask (admin)', async () => {
      const res = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taskCode: '1.1',
          name: 'Rack Power Installation',
          parentTaskId: createdTaskId,
          isMilestone: true,
          isBillable: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.taskCode).toBe('1.1');
      expect(res.body.parentTaskId).toBe(createdTaskId);
      expect(res.body.isMilestone).toBe(true);
    });
  });

  describe('Budget Lines & Labor Resources', () => {
    it('POST /api/projects/:id/budget-lines — adds planned cost line (admin)', async () => {
      const res = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/budget-lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: createdTaskId,
          lineType: PROJECT_LINE_TYPE.ITEM,
          productId,
          description: 'Cabling Budget Line',
          plannedQuantity: 10,
          unitCost: 200.0,
          unitPrice: 350.0,
        });

      if (res.status !== 201) {
        throw new Error(
          `Create budget line failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(201);
      expect(res.body.budgetLineId).toBeDefined();
      expect(Number(res.body.totalCost)).toBe(2000.0); // 10 * 200
      expect(Number(res.body.totalPrice)).toBe(3500.0); // 10 * 350
    });

    it('POST /api/projects/resources & GET /api/projects/resources — creates labor resource profile', async () => {
      const res = await request(baseUrl)
        .post('/api/projects/resources')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Senior Infrastructure Architect',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'EA',
          directUnitCost: 120.0,
          unitPrice: 240.0,
          isActive: true,
        });

      if (res.status !== 201) {
        throw new Error(
          `Create resource failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(201);
      expect(res.body.resourceId).toBeDefined();
      expect(res.body.name).toBe('Senior Infrastructure Architect');
      createdResourceId = res.body.resourceId;

      const listRes = await request(baseUrl)
        .get('/api/projects/resources?q=Infrastructure')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(
        listRes.body.some((r: any) => r.resourceId === createdResourceId),
      ).toBe(true);
    });

    it('GET /api/projects/resources/:id — retrieves resource details by ID', async () => {
      const res = await request(baseUrl)
        .get(`/api/projects/resources/${createdResourceId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceId).toBe(createdResourceId);
      expect(res.body.name).toBe('Senior Infrastructure Architect');
    });

    it('PATCH /api/projects/resources/:id — updates resource rates and name', async () => {
      const res = await request(baseUrl)
        .patch(`/api/projects/resources/${createdResourceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Lead Cloud Architect',
          directUnitCost: 135.0,
          unitPrice: 275.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Lead Cloud Architect');
      expect(Number(res.body.directUnitCost)).toBe(135.0);
      expect(Number(res.body.unitPrice)).toBe(275.0);
    });

    it('POST /api/projects/resources/:id/archive & unarchive — transitions active status', async () => {
      const archiveRes = await request(baseUrl)
        .post(`/api/projects/resources/${createdResourceId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(archiveRes.status).toBe(201);
      expect(archiveRes.body.isActive).toBe(false);

      const unarchiveRes = await request(baseUrl)
        .post(`/api/projects/resources/${createdResourceId}/unarchive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(unarchiveRes.status).toBe(201);
      expect(unarchiveRes.body.isActive).toBe(true);
    });

    it('DELETE /api/projects/resources/:id — deletes unreferenced resource', async () => {
      const tempRes = await request(baseUrl)
        .post('/api/projects/resources')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Temporary E2E Resource',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'EA',
          directUnitCost: 50.0,
          unitPrice: 100.0,
        });

      const tempId = tempRes.body.resourceId;
      const deleteRes = await request(baseUrl)
        .delete(`/api/projects/resources/${tempId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      const checkRes = await request(baseUrl)
        .get(`/api/projects/resources/${tempId}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('DELETE /api/projects/resources/:id — rejects deleting resource referenced in budget lines (400)', async () => {
      // Add budget line referencing createdResourceId
      await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/budget-lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: createdTaskId,
          lineType: PROJECT_LINE_TYPE.RESOURCE,
          resourceId: createdResourceId,
          description: 'Architect Labor Hours',
          plannedQuantity: 20,
          unitCost: 135.0,
          unitPrice: 275.0,
        })
        .expect(201);

      // Attempting delete must fail with 400
      const deleteRes = await request(baseUrl)
        .delete(`/api/projects/resources/${createdResourceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.message).toContain('cannot be deleted');
    });
  });

  describe('Material Consumption & Profitability Analysis', () => {
    it('POST /api/projects/:id/issue-inventory — rejects issuing with invalid bin (400)', async () => {
      const badRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/issue-inventory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: createdTaskId,
          productId,
          locationId,
          binId: '00000000-0000-4000-8000-999999999999',
          quantity: 1,
        });
      expect(badRes.status).toBe(400);
    });
    it('POST /api/projects/:id/issue-inventory & POST /api/projects/:id/return-inventory — logs job costing movements', async () => {
      // Issue material to project
      const issueRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/issue-inventory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: createdTaskId,
          productId,
          locationId,
          binId,
          quantity: 4,
          unitCost: 200.0,
          unitPrice: 350.0,
          memo: 'Issued 4 cable drums for rack setup',
        });

      if (issueRes.status !== 201) {
        throw new Error(
          `Issue inventory failed: ${issueRes.status} ${JSON.stringify(issueRes.body)}`,
        );
      }

      expect(issueRes.status).toBe(201);
      expect(issueRes.body.ledgerId).toBeDefined();
      expect(Number(issueRes.body.quantity)).toBe(4);
      expect(Number(issueRes.body.totalCostBase)).toBe(800.0); // 4 * 200

      // Return 1 unused material drum
      const returnRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/return-inventory`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: createdTaskId,
          productId,
          locationId,
          binId,
          quantity: 1,
          memo: 'Returned 1 unused cable drum',
        });

      if (returnRes.status !== 201) {
        throw new Error(
          `Return inventory failed: ${returnRes.status} ${JSON.stringify(returnRes.body)}`,
        );
      }

      expect(returnRes.status).toBe(201);
      expect(Number(returnRes.body.quantity)).toBe(-1);
      expect(Number(returnRes.body.totalCostBase)).toBe(-200.0);
    });

    it('GET /api/projects/:id/profitability — calculates financial variance summary (viewer)', async () => {
      const res = await request(baseUrl)
        .get(`/api/projects/${createdProjectId}/profitability`)
        .set('Authorization', `Bearer ${viewerToken}`);

      if (res.status !== 200) {
        throw new Error(
          `Profitability failed: ${res.status} ${JSON.stringify(res.body)}`,
        );
      }

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(createdProjectId);
      expect(res.body.totalBudgetCost).toBeDefined();
      expect(res.body.totalActualCost).toBe(600.0); // 800 - 200 = 600
      expect(res.body.materialActualCost).toBe(600.0);
      expect(res.body.costVariance).toBeDefined();
    });
  });

  describe('Project State Lifecycle Transitions', () => {
    it('POST /api/projects/:id/state — advances project through valid states (admin)', async () => {
      // DRAFT -> ACTIVE
      const activeRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: PROJECT_STATE.ACTIVE,
          reason: 'Activating project delivery',
        });
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.stateCode).toBe(PROJECT_STATE.ACTIVE);

      // ACTIVE -> CLOSED
      const closedRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: PROJECT_STATE.CLOSED,
          reason: 'Project work and billing complete',
        });
      expect(closedRes.status).toBe(200);
      expect(closedRes.body.stateCode).toBe(PROJECT_STATE.CLOSED);
      expect(closedRes.body.actualEndDate).toBeDefined();

      // CLOSED -> ACTIVE (Reopen)
      const reopenRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: PROJECT_STATE.ACTIVE,
          reason: 'Reopening project for additional work',
        });
      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.stateCode).toBe(PROJECT_STATE.ACTIVE);
    });

    it('POST /api/projects/:id/state — rejects invalid state transitions', async () => {
      // ACTIVE cannot transition directly back to DRAFT
      const res = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: PROJECT_STATE.DRAFT });

      expect(res.status).toBe(400);
    });
  });

  describe('Project Notes Sub-Resource', () => {
    let createdNoteId: string;

    it('POST /api/projects/:id/notes & GET /api/projects/:id/notes — creates and lists chronological notes', async () => {
      const noteRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Kickoff meeting complete. Client approved rack layout.',
        });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.noteId).toBeDefined();
      expect(noteRes.body.content).toBe(
        'Kickoff meeting complete. Client approved rack layout.',
      );
      createdNoteId = noteRes.body.noteId;

      const listRes = await request(baseUrl)
        .get(`/api/projects/${createdProjectId}/notes`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      const foundNote = listRes.body.find(
        (n: any) => n.noteId === createdNoteId,
      );
      expect(foundNote).toBeDefined();
      expect(foundNote.content).toBe(
        'Kickoff meeting complete. Client approved rack layout.',
      );
    });

    it('DELETE /api/projects/:id/notes/:noteId — removes note and denies unauthorized viewer', async () => {
      // Viewer cannot delete note (403)
      const viewerDel = await request(baseUrl)
        .delete(`/api/projects/${createdProjectId}/notes/${createdNoteId}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerDel.status).toBe(403);

      // Admin deletes note (200)
      const adminDel = await request(baseUrl)
        .delete(`/api/projects/${createdProjectId}/notes/${createdNoteId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDel.status).toBe(200);

      // Check note is deleted
      const checkRes = await request(baseUrl)
        .get(`/api/projects/${createdProjectId}/notes`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(checkRes.body.some((n: any) => n.noteId === createdNoteId)).toBe(
        false,
      );
    });
  });

  describe('Project Invoicing & Billing Workflow (e2e)', () => {
    let billingProjectId: string;
    let billingTaskId: string;
    let billingResourceId: string;
    let laborLedgerId: string;
    let expenseLedgerId: string;
    let billedInvoiceId: string;

    beforeAll(async () => {
      // 1. Create a dedicated project for billing in ACTIVE state
      const pRes = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Turnkey Cloud Deployment',
          customerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'AUD',
          startDate: '2026-10-01T00:00:00.000Z',
        });
      if (pRes.status !== 201) {
        throw new Error(
          `Billing project create failed: ${pRes.status} ${JSON.stringify(pRes.body)}`,
        );
      }
      billingProjectId = pRes.body.projectId;

      const stateRes = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: PROJECT_STATE.ACTIVE });
      if (stateRes.status !== 200) {
        throw new Error(
          `Set active failed: ${stateRes.status} ${JSON.stringify(stateRes.body)}`,
        );
      }

      // 2. Create task
      const tRes = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          taskCode: 'BILL-1',
          name: 'Core Infrastructure Setup',
        });
      if (tRes.status !== 201) {
        throw new Error(
          `Billing task create failed: ${tRes.status} ${JSON.stringify(tRes.body)}`,
        );
      }
      billingTaskId = tRes.body.projectTaskId;

      // 3. Create a labor resource for billing
      const rRes = await request(baseUrl)
        .post('/api/projects/resources')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Lead DevOps Consultant',
          resourceType: RESOURCE_TYPE.PERSON,
          baseUom: 'EA',
          directUnitCost: 100.0,
          unitPrice: 200.0,
          isActive: true,
        });
      if (rRes.status !== 201) {
        throw new Error(
          `Billing resource create failed: ${rRes.status} ${JSON.stringify(rRes.body)}`,
        );
      }
      billingResourceId = rRes.body.resourceId;

      // 4. Log labor resource usage (Time & Materials)
      const resUsage = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/consume-resource`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: billingTaskId,
          resourceId: billingResourceId,
          quantity: 10,
          billableRate: 200,
          isBillable: true,
          description: 'Lead DevOps Engineering Hours',
        });
      if (resUsage.status !== 201) {
        throw new Error(
          `Consume resource failed: ${resUsage.status} ${JSON.stringify(resUsage.body)}`,
        );
      }
      laborLedgerId = resUsage.body.ledgerId;

      // 5. Log expense
      const expUsage = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/consume-expense`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectTaskId: billingTaskId,
          description: 'Cloud Infrastructure Hosting Pass-through',
          costAmount: 400,
          billableAmount: 500,
          isBillable: true,
        });
      if (expUsage.status !== 201) {
        throw new Error(
          `Consume expense failed: ${expUsage.status} ${JSON.stringify(expUsage.body)}`,
        );
      }
      expenseLedgerId = expUsage.body.ledgerId;
    });

    it('POST /api/projects/:id/bill — generates Sales Invoice snapshotting tax, discount, and project metadata', async () => {
      const billRes = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Invoice for Project Deployment Phase 1',
          lines: [
            {
              projectLedgerEntryId: laborLedgerId,
              description: 'Lead DevOps Engineering Hours',
              quantity: 10,
              pricePerUnit: 200,
              discountPercentage: 10, // 10% discount
            },
            {
              projectLedgerEntryId: expenseLedgerId,
              description: 'Cloud Infrastructure Hosting Pass-through',
              quantity: 1,
              pricePerUnit: 500,
              discountPercentage: 0,
            },
            {
              description: 'Project Initiation Milestone Fee',
              quantity: 1,
              pricePerUnit: 1000,
              discountPercentage: 5,
            },
          ],
        });

      if (billRes.status !== 201) {
        throw new Error(
          `BILL ERROR: status=${billRes.status} body=${JSON.stringify(billRes.body)}`,
        );
      }
      expect(billRes.status).toBe(201);
      expect(billRes.body.invoiceId).toBeDefined();
      expect(billRes.body.invoiceNumber).toBeDefined();
      expect(parseFloat(billRes.body.totalAmount)).toBeGreaterThan(0);
      billedInvoiceId = billRes.body.invoiceId;

      // Verify invoice appears in project invoice list
      const prjInvRes = await request(baseUrl)
        .get(`/api/projects/${billingProjectId}/invoices`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(Array.isArray(prjInvRes.body)).toBe(true);
      const foundPrjInv = prjInvRes.body.find(
        (inv: any) => inv.invoiceId === billedInvoiceId,
      );
      expect(foundPrjInv).toBeDefined();
      expect(foundPrjInv.projectId).toBe(billingProjectId);

      // Verify sales invoice query returns snapshot fields and line items
      const invDetailRes = await request(baseUrl)
        .get(`/api/sales-invoices/${billedInvoiceId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(invDetailRes.body.invoiceId).toBe(billedInvoiceId);
      expect(invDetailRes.body.projectId).toBe(billingProjectId);
      expect(invDetailRes.body.projectNumber).toBeDefined();
      expect(Array.isArray(invDetailRes.body.lines)).toBe(true);
      expect(invDetailRes.body.lines.length).toBe(3);

      // Check snapshot fields on lines
      for (const line of invDetailRes.body.lines) {
        expect(line.taxAmount).toBeDefined();
        expect(line.discountPercentage).toBeDefined();
        expect(line.amount).toBeDefined();
      }

      // Verify project subledger entries marked isBilled
      const ledgerRes = await request(baseUrl)
        .get(`/api/projects/${billingProjectId}/ledger-entries?limit=50`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      const billedLabor = ledgerRes.body.data.find(
        (e: any) => e.ledgerId === laborLedgerId,
      );
      expect(billedLabor).toBeDefined();
      expect(billedLabor.isBilled).toBe(true);
      expect(billedLabor.salesInvoiceLineId).toBeDefined();

      const billedExp = ledgerRes.body.data.find(
        (e: any) => e.ledgerId === expenseLedgerId,
      );
      expect(billedExp).toBeDefined();
      expect(billedExp.isBilled).toBe(true);
      expect(billedExp.salesInvoiceLineId).toBeDefined();
    });

    // --- Off-Golden-Path Tests ---
    it('POST /api/projects/:id/bill — rejects billing with empty lines array (400)', async () => {
      const res = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lines: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one line/i);
    });

    it('POST /api/projects/:id/bill — rejects billing for non-existent project (404)', async () => {
      const res = await request(baseUrl)
        .post('/api/projects/00000000-0000-4000-8000-000000000000/bill')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              description: 'Non-existent project fee',
              quantity: 1,
              pricePerUnit: 100,
            },
          ],
        });

      expect(res.status).toBe(404);
    });

    it('POST /api/projects/:id/bill — rejects billing non-existent ledger entry ID (400)', async () => {
      const res = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              projectLedgerEntryId: '00000000-0000-4000-8000-000000000000',
              description: 'Invalid Ledger Entry',
              quantity: 1,
              pricePerUnit: 100,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not found in project');
    });

    it('PATCH & DELETE /api/projects/:id/ledger-entries/:ledgerId — rejects modifying or deleting billed entry (400)', async () => {
      // Modify billed entry rejected (400)
      const editRes = await request(baseUrl)
        .patch(
          `/api/projects/${billingProjectId}/ledger-entries/${laborLedgerId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Attempt to tamper with billed hours' });

      expect(editRes.status).toBe(400);
      expect(editRes.body.message).toMatch(
        /cannot (edit|modify) a billed ledger entry/i,
      );

      // Delete billed entry rejected (400)
      const delRes = await request(baseUrl)
        .delete(
          `/api/projects/${billingProjectId}/ledger-entries/${laborLedgerId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(400);
      expect(delRes.body.message).toContain(
        'Cannot delete a billed ledger entry',
      );
    });

    it('PATCH /api/sales-invoices/:id/state — cancelling project invoice automatically unbills project ledger entries', async () => {
      const cancelRes = await request(baseUrl)
        .patch(`/api/sales-invoices/${billedInvoiceId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: 'cancelled' })
        .expect(200);

      expect(cancelRes.body.stateCode).toBe('cancelled');

      // Verify unbilling reverted ledger entries to unbilled
      const ledgerRes = await request(baseUrl)
        .get(`/api/projects/${billingProjectId}/ledger-entries?limit=50`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      const unbilledLabor = ledgerRes.body.data.find(
        (e: any) => e.ledgerId === laborLedgerId,
      );
      expect(unbilledLabor).toBeDefined();
      expect(unbilledLabor.isBilled).toBe(false);
      expect(unbilledLabor.salesInvoiceLineId).toBeNull();
    });

    it('POST /api/projects/:id/bill — rejects billing when project is closed (400)', async () => {
      // Close the project
      await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: PROJECT_STATE.CLOSED });

      const res = await request(baseUrl)
        .post(`/api/projects/${billingProjectId}/bill`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              description: 'Fee on closed project',
              quantity: 1,
              pricePerUnit: 100,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot bill a closed project');
    });
  });

  describe('Casbin Authorization RBAC Boundaries', () => {
    it('Viewer role is denied write and mutation operations (403 Forbidden)', async () => {
      // Viewer cannot create projects
      const createRes = await request(baseUrl)
        .post('/api/projects')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Unauthorized Project Creation',
          customerId,
          billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
          currencyCode: 'USD',
        });
      expect(createRes.status).toBe(403);

      // Viewer cannot update projects
      const updateRes = await request(baseUrl)
        .patch(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Hacked Project Name' });
      expect(updateRes.status).toBe(403);

      // Viewer cannot issue materials
      const issueRes = await request(baseUrl)
        .post(`/api/projects/${createdProjectId}/issue-inventory`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectTaskId: createdTaskId,
          productId,
          locationId,
          binId,
          quantity: 1,
        });
      expect(issueRes.status).toBe(403);
    });
  });
});
