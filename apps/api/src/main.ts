import { NestFactory } from '@nestjs/core';
// Force reload 1
import { AppModule } from './app.module';
import { Logger, ValidationPipe, RequestMethod } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { FileLoggerService } from './common/file-logger.service';
import { ConvertEmptyStringsToNullMiddleware } from './common/middleware/convert-empty-strings-to-null.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Prometheus default metrics (CPU, memory, event loop)
  collectDefaultMetrics();

  // --- Safeguard: Prevent Dev Mode in Production ---
  if (
    process.env.DEPLOYMENT_TIER === 'production' &&
    process.env.NODE_ENV !== 'production'
  ) {
    Logger.error(
      'FATAL: Attempted to boot in development mode on a production deployment tier. Crashing to prevent security vulnerabilities.',
    );
    process.exit(1);
  }

  // --- Safeguard: Prevent faketime in Production ---
  if (
    (process.env.NODE_ENV === 'production' || process.env.DEPLOYMENT_TIER === 'production') &&
    process.env.LD_PRELOAD?.includes('faketime')
  ) {
    Logger.error(
      'FATAL: Attempted to boot with libfaketime in a production deployment tier. Crashing to prevent security vulnerabilities.',
    );
    process.exit(1);
  }

  const fileLogger = new FileLoggerService();
  const app = await NestFactory.create(AppModule, {
    logger: fileLogger,
  });

  // Enable graceful shutdown hooks for SIGTERM / SIGINT signals
  app.enableShutdownHooks();

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'internal/setup/webhook', method: RequestMethod.POST }],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  // Clean empty strings out of the request body payload before any pipes/validation run
  const emptyStringMiddleware = new ConvertEmptyStringsToNullMiddleware();
  app.use(emptyStringMiddleware.use.bind(emptyStringMiddleware));

  // Debug middleware to log bodies
  app.use(
    (
      req: { method: string; url: string; body: unknown },
      res: unknown,
      next: () => void,
    ) => {
      if (req.method === 'PATCH' && req.url.includes('/api/customers/')) {
        console.log('--- INCOMING PATCH BODY TO', req.url, '---');
        console.log(req.body);
        console.log('-----------------------------------');
      }
      next();
    },
  );

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
    SwaggerModule.setup('api/docs', app, document);
  }

  // CORS: restrict to explicit origins (ADV-027 fix)
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Prometheus metrics endpoint (outside /api prefix)
  // ARCHITECTURAL EXCEPTION (ADV-027): This endpoint is intentionally outside
  // the NestJS auth pipeline. Mitigations:
  //   - Host port bound to 127.0.0.1 only (docker-compose.yml)
  //   - Prometheus scrapes via internal monitoring-net (custom-api:3001)
  //   - No credentials or PII are exposed via prom-client default metrics
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(
    '/metrics',
    async (
      _req: unknown,
      res: { set: (k: string, v: string) => void; end: (data: string) => void },
    ) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    },
  );

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
// trigger restart 11
