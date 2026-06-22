import * as fs from 'fs';
import * as path from 'path';

const files = [
  'apps/api/src/suppliers/dto.ts',
  'apps/api/src/customers/dto.ts',
  'apps/api/src/products/dto.ts'
];

for (const file of files) {
  const fullPath = path.resolve(__dirname, '../../..', file);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace Transform above @IsNumberString()
  // Pattern: @Transform(({ value }) => (value === '' ? null : value))\n  @IsNumberString()
  const regex = /@Transform\(\(\{ value \}\) => \(value === '' \? null : value\)\)\s*@IsNumberString\(\)/g;
  
  content = content.replace(regex, "@Transform(({ value }) => (value === '' || value === null ? null : String(value)))\n  @IsNumberString()");

  // Some cases might have other decorators in between, let's catch it generally for the known fields
  const fieldsToFixStr = [
    'earlyPaymentDiscount',
    'creditLimit',
    'customerDiscount',
    'defaultDiscountPercentage',
  ];

  for (const field of fieldsToFixStr) {
    const regex2 = new RegExp(`@Transform\\(\\(\\{ value \\}\\) => \\(value === '' \\? null : value\\)\\)([\\s\\S]*?)@IsNumberString\\(\\)([\\s\\S]*?)(${field}\\?:)`, 'g');
    content = content.replace(regex2, "@Transform(({ value }) => (value === '' || value === null ? null : String(value)))$1@IsNumberString()$2$3");
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file}`);
}
