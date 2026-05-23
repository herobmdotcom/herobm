import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function test() {
  const app = await NestFactory.create(AppModule);
  const service = app.get('AccountsService');
  const customer = await service.findOne('0873069b-e486-4229-85ce-4bbc52c005a2');
  console.log('Customer API payload:', JSON.stringify(customer, null, 2));
  await app.close();
}

test();
