import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PickingService } from './orders/picking.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pickingService = app.get(PickingService);
  const q = await pickingService.getPickingQueue();
  const partials = q.filter(x => x.pickabilityStatus === 'partial');
  console.log(JSON.stringify(partials.map(o => ({
    orderNumber: o.orderNumber,
    status: o.pickabilityStatus,
    _linesTotal: o._linesTotal,
    _linesBlocked: o._linesBlocked,
    _linesFullyPickable: o._linesFullyPickable,
  })), null, 2));
  await app.close();
}

run();
