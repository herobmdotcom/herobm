import { validate } from 'class-validator';
import { UpdateAccountDto } from './src/customers/dto';

async function run() {
  const dto = new UpdateAccountDto();
  dto.emailAddress1 = 'sales@actionhydraulics.com.au';
  
  const errors = await validate(dto);
  console.log('Errors for sales@actionhydraulics.com.au:', errors);
}

run();
