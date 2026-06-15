import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('API E2E — Tax Resolution engine', () => {
  let app: INestApplication;
  let adminToken: string;
  let validCustomerId: string;
  let validProductId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: process.env.ADMIN_PASSWORD });
    adminToken = loginRes.body.access_token;

    const db = app.get(DRIZZLE);

    // Get a valid customer and product
    const customerRes = await db.execute(
      sql`SELECT customer_id FROM herobm_core.customers LIMIT 1`,
    );
    validCustomerId = customerRes[0].customer_id;

    const productRes = await db.execute(
      sql`SELECT product_id FROM herobm_core.products LIMIT 1`,
    );
    validProductId = productRes[0].product_id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully create an order and resolve tax based on product default (no mapping)', async () => {
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    const locationId = locRes.body[0].locationId;

    const createPayload = {
      fulfillmentLocationId: locationId,
      customerId: validCustomerId,
      customerReference: 'TAX-E2E',
      salesRepId: null,
      shipToId: null,
      lines: [
        {
          productId: validProductId,
          quantity: '1',
          pricePerUnit: '100.00',
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createPayload);

    expect(response.status).toBe(201);
    expect(response.body.lines[0]).toHaveProperty('taxCategoryId');
  });

  it('should resolve tax based on customer specific tax position mapping', async () => {
    // This scenario should mock a specific customer having a TaxPosition mapping
    // that overrides the product default tax.
  });

  it('should resolve tax based on group-level inheritance when customer has no explicit tax position', async () => {
    // This scenario should test that when customer.taxPositionId is null,
    // but customerGroup.taxPositionId is set, the mapping is evaluated against the group's position.
  });
});
