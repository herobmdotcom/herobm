import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAccountDto } from '../src/customers/dto';

async function test() {
  const payload = {
    customerNumber: 'TEST-123',
    name: 'Test Customer',
    emailAddress1: '',
    telephone1: '',
    billingAddressCountry: 'US',
    customerGroupId: '',
    taxCategoryId: '',
    currencyCode: 'USD',
    customerDiscount: '0',
    notes: '',
    parentCustomerId: '',
    businessNumber: '',
    isTaxRegistered: false,
  };

  const instance = plainToInstance(CreateAccountDto, payload);
  const errors = await validate(instance, { whitelist: true, transform: true });
  if (errors.length > 0) {
    console.log('Validation failed:');
    console.log(JSON.stringify(errors, null, 2));
  } else {
    console.log('Validation succeeded!');
  }
}

test().catch(console.error);
