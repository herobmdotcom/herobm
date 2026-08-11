import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import request from 'supertest';

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
    setupE2eApp(app);
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    if (!loginRes.body || !loginRes.body.access_token) {
      console.error('LOGIN FAILED IN E2E:', loginRes.status, loginRes.body);
    }
    adminToken = loginRes.body?.access_token;

    const db = app.get(DRIZZLE);

    // Get a valid customer and product using endpoints
    const customersRes = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validCustomerId = customersRes.body.data[0].customerId;

    const productsRes = await request(app.getHttpServer())
      .get('/api/products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    validProductId = productsRes.body.data[0].productId;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should successfully create an order and resolve tax based on product default (no mapping)', async () => {
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    const locationId = locRes.body[0].locationId;

    const createPayload = {
      salesOrderId: crypto.randomUUID(),
      fulfillmentLocationId: locationId,
      customerId: validCustomerId,
      deliveryAddressLine1: 'Test Address',
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

    if (response.status !== 201) console.log('TAX RES ERR:', response.body);
    expect(response.status).toBe(201);

    const getRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${response.body.salesOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getRes.body.lines[0]).toHaveProperty('taxCategoryId');
  });

  it('should resolve tax based on customer specific tax position mapping', async () => {
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    const locationId = locRes.body[0].locationId;

    const db = app.get(DRIZZLE);

    const taxCatRes = await request(app.getHttpServer())
      .get('/api/tax-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const categories = taxCatRes.body;
    if (categories.length < 2) return;

    const sourceCategory = categories[0];
    const destinationCategory = categories[1];

    const posRes = await request(app.getHttpServer())
      .post('/api/tax-positions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `TP_CUST_${Date.now()}`, title: 'E2E Cust Tax Position' })
      .expect(201);
    const taxPositionId = posRes.body.taxPositionId;

    await request(app.getHttpServer())
      .post(`/api/tax-positions/${taxPositionId}/mappings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sourceTaxCategoryId: sourceCategory.taxCategoryId,
        destinationTaxCategoryId: destinationCategory.taxCategoryId,
      })
      .expect(201);

    await db.execute(
      sql`UPDATE herobm_core.customers SET tax_position_id = ${taxPositionId}::uuid WHERE customer_id = ${validCustomerId}::uuid`,
    );

    await db.execute(
      sql`UPDATE herobm_core.products SET sales_tax_category_id = ${sourceCategory.taxCategoryId}::uuid WHERE product_id = ${validProductId}::uuid`,
    );

    const createPayload = {
      salesOrderId: crypto.randomUUID(),
      fulfillmentLocationId: locationId,
      customerId: validCustomerId,
      deliveryAddressLine1: 'Test Address',
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
      .send(createPayload)
      .expect(201);

    const getRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${response.body.salesOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getRes.body.lines[0].taxCategoryId).toBe(
      destinationCategory.taxCategoryId,
    );
  });

  it('should resolve tax based on group-level inheritance when customer has no explicit tax position', async () => {
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`);
    const locationId = locRes.body[0].locationId;

    const db = app.get(DRIZZLE);

    const taxCatRes = await request(app.getHttpServer())
      .get('/api/tax-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const categories = taxCatRes.body;
    if (categories.length < 2) return;

    const sourceCategory = categories[0];
    const destinationCategory = categories[1];

    const posRes = await request(app.getHttpServer())
      .post('/api/tax-positions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `TP_GRP_${Date.now()}`, title: 'E2E Group Tax Position' })
      .expect(201);
    const taxPositionId = posRes.body.taxPositionId;

    await request(app.getHttpServer())
      .post(`/api/tax-positions/${taxPositionId}/mappings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sourceTaxCategoryId: sourceCategory.taxCategoryId,
        destinationTaxCategoryId: destinationCategory.taxCategoryId,
      })
      .expect(201);

    const groupRes = await db.execute(sql`
      INSERT INTO herobm_core.customer_groups (group_code, name, state_code, is_on_credit_hold, tax_position_id)
      VALUES (${'GRP_' + Date.now()}, 'E2E Group', 'active', false, ${taxPositionId}::uuid)
      RETURNING customer_group_id
    `);
    const groupRows = groupRes.rows || groupRes;
    const groupId = groupRows[0].customer_group_id;

    await db.execute(
      sql`UPDATE herobm_core.customers SET customer_group_id = ${groupId}::uuid, tax_position_id = NULL WHERE customer_id = ${validCustomerId}::uuid`,
    );

    await db.execute(
      sql`UPDATE herobm_core.products SET sales_tax_category_id = ${sourceCategory.taxCategoryId}::uuid WHERE product_id = ${validProductId}::uuid`,
    );

    const createPayload = {
      salesOrderId: crypto.randomUUID(),
      fulfillmentLocationId: locationId,
      customerId: validCustomerId,
      deliveryAddressLine1: 'Test Address',
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
      .send(createPayload)
      .expect(201);

    const getRes = await request(app.getHttpServer())
      .get(`/api/sales-orders/${response.body.salesOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getRes.body.lines[0].taxCategoryId).toBe(
      destinationCategory.taxCategoryId,
    );
  });
});
