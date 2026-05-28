import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { FileLoggerService } from './common/file-logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Prometheus default metrics (CPU, memory, event loop)
  collectDefaultMetrics();

  const fileLogger = new FileLoggerService();
  const app = await NestFactory.create(AppModule, {
    logger: fileLogger,
  });

  // Enable graceful shutdown hooks for SIGTERM / SIGINT signals
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  // Debug middleware to log bodies
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'PATCH' && req.url.includes('/api/customers/')) {
      console.log('--- INCOMING PATCH BODY TO', req.url, '---');
      console.log(req.body);
      console.log('-----------------------------------');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (process.env.ENABLE_SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('HeroBM API')
      .setDescription('Core API System endpoints')
      .setVersion('1.0')
      .addBearerAuth()
      .addServer('http://localhost:3000', 'Local Development Server')
      .addTag('Auth', 'Authentication and Authorization')
      .addTag('Users', 'User management')
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
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // CORS: restrict to explicit origins (ADV-027 fix)
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4300')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Prometheus metrics endpoint (outside /api prefix)
  // ARCHITECTURAL EXCEPTION (ADV-027): This endpoint is intentionally outside
  // the NestJS auth pipeline. Mitigations:
  //   - Host port bound to 127.0.0.1 only (docker-compose.yml)
  //   - Prometheus scrapes via internal monitoring-net (custom-api:3001)
  //   - No credentials or PII are exposed via prom-client default metrics
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/metrics', async (_req: any, res: any) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  const port = process.env.PORT ?? process.env.API_PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
// trigger restart
// trigger restart
// trigger restart 2
// trigger restart 3
// trigger restart 4
// trigger restart 5
// trigger restart 6
// trigger restart 7
// trigger restart 8
// trigger restart 9
// trigger restart 10
