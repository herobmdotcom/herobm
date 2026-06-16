/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment -- External API integration boundaries where exact types are unknown. */
export {};
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Imports will be dynamic to allow dotenv to run first

async function generateDocs() {
  process.env.USE_PGLITE = 'true';
  process.env.JWT_SECRET = 'dummy_secret_for_openapi_generation';
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
    .addTag('System', 'System configuration, webhooks, auth, and setup')
    .addTag('Customers', 'Customer management and CRM')
    .addTag('Contacts', 'Customer and supplier contacts')
    .addTag('Delivery Addresses', 'Delivery locations')
    .addTag('Products', 'Product catalog and master data')
    .addTag('Suppliers', 'Supplier and vendor management')
    .addTag('Sales Orders', 'Sales order processing')
    .addTag('Sales Returns', 'Customer returns (RMA)')
    .addTag('Sales Invoices', 'Accounts Receivable invoices')
    .addTag('Purchase Orders', 'Purchase order processing')
    .addTag('Purchase Returns', 'Return to vendor (RTV)')
    .addTag('Purchase Invoices', 'Accounts Payable invoices')
    .addTag('Transfer Orders', 'Multi-location inventory transfers')
    .addTag('Warehouse', 'Inventory, receiving, and fulfillment')
    .addTag('Payments', 'Payment processing and reconciliation')
    .addTag('General Ledger', 'Accounting, charts, and journals')
    .addTag('Tax', 'Tax configuration and mappings')
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
