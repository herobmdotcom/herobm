/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Imports will be dynamic to allow dotenv to run first

async function generateDocs() {
  const { NestFactory } = require('@nestjs/core');
  // @ts-ignore
  const { AppModule } = require('../app.module');
  const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
  const fs = require('fs');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  const config = new DocumentBuilder()
    .setTitle('HeroBM API')
    .setDescription('Core API System endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('http://localhost:3000', 'Local Development Server')
    .addTag('Auth', 'Authentication and Authorization')
    .addTag('Users', 'User management')
    .addTag('Roles', 'Role management')
    .addTag('System', 'System configuration')
    .addTag('Telemetry', 'Client-side telemetry')
    .addTag('Dashboard', 'Dashboard statistics and timeline')
    .addTag('Products', 'Product catalog')
    .addTag('Customers', 'Customer management')
    .addTag('Suppliers', 'Supplier management')
    .addTag('Locations', 'Warehouse locations')
    .addTag('Tax', 'Tax configuration')
    .addTag('Orders', 'Sales orders')
    .addTag('PurchaseOrders', 'Purchase orders')
    .addTag('PurchaseReturns', 'Purchase returns (RTV)')
    .addTag('PurchaseDebitNotes', 'Supplier debit notes')
    .addTag('Inventory', 'Inventory levels and movements')
    .addTag('Invoices', 'Sales invoices')
    .addTag('Payments', 'Payment reconciliation')
    .addTag('GL', 'General Ledger')
    .addTag('DiscountMatrix', 'Pricing logic and discounts')
    .addTag('Webhooks', 'Outbound webhooks')
    .addTag('ApiKeys', 'Service API keys')
    .addTag('Setup', 'System setup and data import')
    .addTag('Macros', 'Automated macros')
    .addTag('GoodsReceived', 'Goods Receipt Notes (GRNI)')
    .addTag('Reports', 'Reporting hooks')
    .addTag('Events', 'System events')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath1 = path.resolve(
    __dirname,
    '../../../../apps/ops-portal/public/openapi.json',
  );
  const outPath2 = path.resolve(
    __dirname,
    '../../../../docs/developers/openapi.json',
  );
  fs.writeFileSync(outPath1, JSON.stringify(document, null, 2));
  fs.writeFileSync(outPath2, JSON.stringify(document, null, 2));
  console.log(`Wrote openapi.json to ${outPath1} and ${outPath2}`);
  await app.close();
  console.log(
    'Successfully generated openapi.json at',
    outPath1,
    'and',
    outPath2,
  );
  process.exit(0);
}

generateDocs().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
