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

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ModBM API')
    .setDescription('Core Forgeron API System endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

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

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap().catch((err) => {
  Logger.error(err);
  process.exit(1);
});
