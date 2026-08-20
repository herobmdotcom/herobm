import { NestFactory } from '@nestjs/core';
// Force reload 1
import { AppModule } from './app.module';
import { Logger, ValidationPipe, RequestMethod } from '@nestjs/common';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { FileLoggerService } from './common/file-logger.service';
import { ConvertEmptyStringsToNullMiddleware } from './common/middleware/convert-empty-strings-to-null.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EnvService } from './common/config/env.service';

async function bootstrap() {
  const fileLogger = new FileLoggerService();
  const app = await NestFactory.create(AppModule, {
    logger: fileLogger,
  });

  const envService = app.get(EnvService);

  // --- Safeguard: Prevent Dev Mode in Production ---
  if (envService.deploymentTier === 'production' && !envService.isProduction) {
    Logger.error(
      'FATAL: Attempted to boot in development mode on a production deployment tier. Crashing to prevent security vulnerabilities.',
    );
    process.exit(1);
  }

  // Enable graceful shutdown hooks for SIGTERM / SIGINT signals
  app.enableShutdownHooks();

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'internal/setup/webhook', method: RequestMethod.POST }],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  // Clean empty strings out of the request body payload before any pipes/validation run
  const emptyStringMiddleware = new ConvertEmptyStringsToNullMiddleware();
  app.use(emptyStringMiddleware.use.bind(emptyStringMiddleware));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (envService.enableSwagger) {
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
      .addTag(
        'Manufacturing / Work Orders',
        'Manufacturing work orders and assembly',
      )
      .addTag('Warehouse', 'Inventory, receiving, and fulfillment')
      .addTag('Payments', 'Payment processing and reconciliation')
      .addTag('General Ledger', 'Accounting, charts, and journals')
      .addTag('Tax', 'Tax configuration and mappings')
      .addTag(
        'Unified Returns',
        'Global queries across sales and purchase returns',
      )
      .addTag('Global Notes', 'Global cross-domain notes')
      .addTag('Help', 'In-app user documentation and field guides')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // CORS: restrict to explicit origins (ADV-027 fix)
  const corsOrigins = envService.corsOrigins;
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Observability & metrics endpoint (outside /api prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(
    '/metrics',
    (
      _req: unknown,
      res: {
        set: (k: string, v: string) => void;
        json: (data: unknown) => void;
      },
    ) => {
      res.set('Content-Type', 'application/json');
      res.json({
        telemetry: 'opentelemetry',
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    },
  );

  const port = envService.port;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
