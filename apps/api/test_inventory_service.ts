import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { InventoryService } from './src/inventory/inventory.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(InventoryService);

  try {
    const res = await service.findByProductIds(['bc6f77df-5769-4674-b8f6-f3ad47a25c02']);
    console.log("Success:", res);
  } catch (err) {
    console.error("Caught error in script!");
  }
  await app.close();
}
run();
