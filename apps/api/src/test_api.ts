import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './gl/reconciliation.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ReconciliationService);

  // We'll test with the reconciliation ID from our previous queries
  const recId = '2dfad30a-8770-4ba5-90b7-8dd5bd53d3ba';

  const lines = await service.getLines(recId);
  const matchedLine = lines.find(
    (l) => l.matchGroupId === '654ab5a4-befa-4214-9e99-5b9c3747d146',
  );

  console.log('Matched line:', matchedLine);
  await app.close();
}

bootstrap();
