import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { AllocationsController } from './apps/api/src/orders/allocations.controller';
import { BackordersService } from './apps/api/src/orders/backorders.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const allocationsController = app.get(AllocationsController);
  const backordersService = app.get(BackordersService);

  console.log('Testing available-po-lines...');
  const lines = await backordersService.getAvailablePoLines('123'); // dummy product id
  console.log('Found lines:', lines);

  await app.close();
}

bootstrap().catch(console.error);
