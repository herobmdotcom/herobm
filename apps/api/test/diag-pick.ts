/**
 * Diagnostic
 */
import '../test/setup-env';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

async function main() {
  const mod = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: 'admin', password: process.env.ADMIN_PASSWORD });
  const token = login.body.access_token;

  // Let's find an order that is picking! Or just make one
  const accts = await request(app.getHttpServer())
    .get('/api/customers?limit=1')
    .set('Authorization', `Bearer ${token}`);
  const prods = await request(app.getHttpServer())
    .get('/api/products?limit=1')
    .set('Authorization', `Bearer ${token}`);

  const res = await request(app.getHttpServer())
    .post('/api/sales-orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId: accts.body.data[0].customerId,
      lines: [
        {
          productId: prods.body.data[0].productId,
          quantity: '1',
          pricePerUnit: '10.00',
        },
      ],
    });
  const orderId = res.body.salesOrderId;
  console.log('Order:', orderId);

  // transition to picking
  await request(app.getHttpServer())
    .patch(`/api/sales-orders/${orderId}/state`)
    .set('Authorization', `Bearer ${token}`)
    .send({ stateCode: 'quoted', generateBackorders: false });
  await request(app.getHttpServer())
    .patch(`/api/sales-orders/${orderId}/state`)
    .set('Authorization', `Bearer ${token}`)
    .send({ stateCode: 'confirmed', generateBackorders: false });
  await request(app.getHttpServer())
    .patch(`/api/sales-orders/${orderId}/state`)
    .set('Authorization', `Bearer ${token}`)
    .send({ stateCode: 'picking', generateBackorders: false });

  const pickRes = await request(app.getHttpServer())
    .post(`/api/sales-orders/${orderId}/picking/pick-all`)
    .set('Authorization', `Bearer ${token}`);

  console.log('Pick All status:', pickRes.status);
  console.log('Pick All body:', JSON.stringify(pickRes.body, null, 2));

  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
