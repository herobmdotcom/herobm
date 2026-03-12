import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

async function bootstrap() {
  // Prometheus default metrics (CPU, memory, event loop)
  collectDefaultMetrics();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.setGlobalPrefix('api');
  app.enableCors();

  // Prometheus metrics endpoint (outside /api prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/metrics', async (_req: any, res: any) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
