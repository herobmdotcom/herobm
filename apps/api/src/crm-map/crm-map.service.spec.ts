import { Test, TestingModule } from '@nestjs/testing';
import { CrmMapService } from './crm-map.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  organizations,
  contacts,
  opportunities,
  customers,
  salesOrders,
  projects,
  organizationOrganizationLinks,
  organizationContactLinks,
  opportunityOrganizations,
  opportunityContacts,
  locations,
} from '@herobm/db-schema';
import {
  ORGANIZATION_STATE,
  CONTACT_STATE,
  OPPORTUNITY_STATE,
  CUSTOMER_STATE,
  SALES_ORDER_STATE,
  PROJECT_STATE,
  PROJECT_BILLING_TYPE,
} from '@herobm/shared';

describe('CrmMapService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: CrmMapService;

  beforeEach(async () => {
    await pg.db.delete(salesOrders);
    await pg.db.delete(projects);
    await pg.db.delete(opportunityOrganizations);
    await pg.db.delete(opportunityContacts);
    await pg.db.delete(organizationOrganizationLinks);
    await pg.db.delete(organizationContactLinks);
    await pg.db.delete(opportunities);
    await pg.db.delete(customers);
    await pg.db.delete(contacts);
    await pg.db.delete(organizations);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CrmMapService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<CrmMapService>(CrmMapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all nodes and edges including sales orders and projects when focalNodeId is omitted', async () => {
    // 1. Create Organization
    const [org] = await pg.db
      .insert(organizations)
      .values({
        name: 'Apex Industrial',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        industry: 'Manufacturing',
        isTaxRegistered: true,
      })
      .returning();

    // 2. Create Customer
    const [cust] = await pg.db
      .insert(customers)
      .values({
        organizationId: org.organizationId,
        customerNumber: 'CUST-APEX',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
      })
      .returning();

    // 3. Create Contact
    const [contact] = await pg.db
      .insert(contacts)
      .values({
        firstName: 'John',
        lastName: 'Doe',
        stateCode: CONTACT_STATE.ACTIVE,
      })
      .returning();

    await pg.db.insert(organizationContactLinks).values({
      organizationId: org.organizationId,
      contactId: contact.contactId,
      linkType: 'employee',
      primaryFor: ['purchasing'],
    });

    // 4. Create Opportunity
    const [opp] = await pg.db
      .insert(opportunities)
      .values({
        name: 'Conveyor System Deal',
        stateCode: OPPORTUNITY_STATE.ACTIVE,
        status: 'proposal',
        type: 'commercial',
      })
      .returning();

    await pg.db.insert(opportunityOrganizations).values({
      opportunityId: opp.opportunityId,
      organizationId: org.organizationId,
      roles: ['Customer'],
    });

    // 5. Create Location for Sales Order
    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'MAIN-LOC',
        name: 'Main Warehouse',
        source: 'app',
      })
      .returning();

    // 6. Create Sales Order
    const [so] = await pg.db
      .insert(salesOrders)
      .values({
        orderNumber: 'SO-2026-0001',
        name: 'Initial Conveyor Order',
        customerId: cust.customerId,
        opportunityId: opp.opportunityId,
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        baseTotalAmount: '75000.00',
        currencyCode: 'USD',
        exchangeRate: '1.0',
        fulfillmentLocationId: loc.locationId,
        discrepanciesAcknowledged: false,
        source: 'app',
      })
      .returning();

    // 7. Create Project
    const [proj] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-2026-0001',
        name: 'Site Installation & Retrofit',
        customerId: cust.customerId,
        opportunityId: opp.opportunityId,
        stateCode: PROJECT_STATE.ACTIVE,
        stage: 'In Progress',
        billingType: PROJECT_BILLING_TYPE.TIME_AND_MATERIALS,
        currencyCode: 'USD',
      })
      .returning();

    const data = await service.getMapData();

    expect(data.nodes.organizations.length).toBe(1);
    expect(data.nodes.contacts.length).toBe(1);
    expect(data.nodes.opportunities.length).toBe(1);
    expect(data.nodes.salesOrders.length).toBe(1);
    expect(data.nodes.salesOrders[0].orderNumber).toBe('SO-2026-0001');
    expect(data.nodes.projects.length).toBe(1);
    expect(data.nodes.projects[0].projectNumber).toBe('PRJ-2026-0001');

    expect(data.edges.organizationSalesOrder?.length).toBe(1);
    expect(data.edges.opportunitySalesOrder?.length).toBe(1);
    expect(data.edges.organizationProject?.length).toBe(1);
    expect(data.edges.opportunityProject?.length).toBe(1);
  });

  it('should traverse BFS from focal organization and include linked sales orders and projects', async () => {
    // Org A (Focal)
    const [orgA] = await pg.db
      .insert(organizations)
      .values({
        name: 'Org A',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        isTaxRegistered: false,
      })
      .returning();

    const [custA] = await pg.db
      .insert(customers)
      .values({
        organizationId: orgA.organizationId,
        customerNumber: 'CUST-A',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
      })
      .returning();

    // Org B (Unconnected / far away)
    const [orgB] = await pg.db
      .insert(organizations)
      .values({
        name: 'Org B',
        stateCode: ORGANIZATION_STATE.ACTIVE,
        isTaxRegistered: false,
      })
      .returning();

    const [custB] = await pg.db
      .insert(customers)
      .values({
        organizationId: orgB.organizationId,
        customerNumber: 'CUST-B',
        currencyCode: 'USD',
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
      })
      .returning();

    const [loc] = await pg.db
      .insert(locations)
      .values({
        code: 'LOC-TEST',
        name: 'Test Location',
        source: 'app',
      })
      .returning();

    // Sales Order for Org A
    const [soA] = await pg.db
      .insert(salesOrders)
      .values({
        orderNumber: 'SO-A',
        customerId: custA.customerId,
        stateCode: SALES_ORDER_STATE.DRAFT,
        currencyCode: 'USD',
        exchangeRate: '1.0',
        fulfillmentLocationId: loc.locationId,
        discrepanciesAcknowledged: false,
        source: 'app',
      })
      .returning();

    // Sales Order for Org B (Unconnected)
    await pg.db.insert(salesOrders).values({
      orderNumber: 'SO-B',
      customerId: custB.customerId,
      stateCode: SALES_ORDER_STATE.DRAFT,
      currencyCode: 'USD',
      exchangeRate: '1.0',
      fulfillmentLocationId: loc.locationId,
      discrepanciesAcknowledged: false,
      source: 'app',
    });

    // Project for Org A
    const [projA] = await pg.db
      .insert(projects)
      .values({
        projectNumber: 'PRJ-A',
        name: 'Project A',
        customerId: custA.customerId,
        stateCode: PROJECT_STATE.ACTIVE,
        billingType: PROJECT_BILLING_TYPE.FIXED_PRICE,
        currencyCode: 'USD',
      })
      .returning();

    // Project for Org B (Unconnected)
    await pg.db.insert(projects).values({
      projectNumber: 'PRJ-B',
      name: 'Project B',
      customerId: custB.customerId,
      stateCode: PROJECT_STATE.ACTIVE,
      billingType: PROJECT_BILLING_TYPE.FIXED_PRICE,
      currencyCode: 'USD',
    });

    const result = await service.getMapData(orgA.organizationId, 1);

    expect(result.nodes.organizations.length).toBe(1);
    expect(result.nodes.organizations[0].organizationId).toBe(
      orgA.organizationId,
    );

    expect(result.nodes.salesOrders.length).toBe(1);
    expect(result.nodes.salesOrders[0].salesOrderId).toBe(soA.salesOrderId);

    expect(result.nodes.projects.length).toBe(1);
    expect(result.nodes.projects[0].projectId).toBe(projA.projectId);

    expect(result.edges.organizationSalesOrder?.length).toBe(1);
    expect(result.edges.organizationProject?.length).toBe(1);
  });
});
