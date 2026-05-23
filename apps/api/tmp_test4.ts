import { validate, IsOptional, ValidateIf, IsEmail } from 'class-validator';

class TestDto {
  @IsOptional()
  @ValidateIf(o => o.emailAddress1 !== '')
  @IsEmail()
  emailAddress1?: string | null;
}

async function run() {
  const dto = new TestDto();
  dto.emailAddress1 = null;
  const errors = await validate(dto);
  console.log('Errors for null:', errors.map(e => e.constraints));

  const dto2 = new TestDto();
  dto2.emailAddress1 = undefined;
  const errors2 = await validate(dto2);
  console.log('Errors for undefined:', errors2.map(e => e.constraints));
  
  const dto3 = new TestDto();
  dto3.emailAddress1 = '';
  const errors3 = await validate(dto3);
  console.log('Errors for empty string:', errors3.map(e => e.constraints));
}

run();
