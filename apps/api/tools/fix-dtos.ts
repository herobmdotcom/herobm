import * as fs from 'fs';
import * as path from 'path';

const files = [
  'apps/api/src/suppliers/dto.ts',
  'apps/api/src/customers/dto.ts',
  'apps/api/src/products/dto.ts'
];

const fieldsToFix = [
  'earlyPaymentDiscount',
  'earlyPaymentDiscountDays',
  'creditLimit',
  'taxPositionId',
  'isOnCreditHold',
  'isPaymentBlocked',
  'isPurchasingBlocked',
  'customerDiscount',
  'defaultDiscountPercentage',
  'salesTaxCategoryId',
  'purchaseTaxCategoryId',
  'tradingTermsId'
];

for (const file of files) {
  const fullPath = path.resolve(__dirname, '../../..', file);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');

  // ensure Transform is imported
  if (!content.includes('Transform')) {
    content = content.replace(/import \{([\s\S]*?)\} from 'class-validator';/, "import {$1} from 'class-validator';\nimport { Transform } from 'class-transformer';");
  }

  // Handle cases where the decorator order might be different
  for (const field of fieldsToFix) {
    const regex = new RegExp(`(@IsOptional\\(\\)[\\s\\n]+)(@[a-zA-Z_]+\\([^)]*\\)[\\s\\n]+)*(${field}\\?:)`, 'g');
    content = content.replace(regex, (match) => {
      if (match.includes('Transform')) return match;
      return match.replace('@IsOptional()\n', "@IsOptional()\n  @Transform(({ value }) => (value === '' ? null : value))\n");
    });
    
    // Fallback if missing \n in replace
    const regex2 = new RegExp(`(@IsOptional\\(\\)\\r?\\n)(\\s*)(@[a-zA-Z_]+\\([^)]*\\)\\r?\\n)*(\\s*)(${field}\\?:)`, 'g');
    content = content.replace(regex2, (match, opt, s1, other, s2, f) => {
      if (match.includes('Transform')) return match;
      return `${opt}${s1}@Transform(({ value }) => (value === '' ? null : value))\n${s1}${other || ''}${s2}${f}`;
    });
  }

  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${file}`);
}
