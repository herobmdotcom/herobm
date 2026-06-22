import * as fs from 'fs';
import * as path from 'path';

const files = [
  'apps/api/src/suppliers/dto.ts',
  'apps/api/src/customers/dto.ts',
  'apps/api/src/products/dto.ts'
];

// We know the UI sends '' for cleared fields. It sends a number for Number inputs.
// So:
// For @IsNumberString():  @Transform(({ value }) => (value === '' || value === null ? null : String(value)))
// For @IsNumber():        @Transform(({ value }) => (value === '' ? null : value)) // class-validator @IsNumber allows JS numbers, UI sends JS number.
// For @IsBoolean():       @Transform(({ value }) => (value === '' ? null : value))
// For @IsUUID():          @Transform(({ value }) => (value === '' ? null : value))
// For @IsString():        @Transform(({ value }) => (value === '' ? null : value)) // Optional strings

const transformStringify = "@Transform(({ value }) => (value === '' || value === null ? null : String(value)))";
const transformNull = "@Transform(({ value }) => (value === '' ? null : value))";

const targetFields = new Set([
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
  'tradingTermsId',
  'defaultArAccountId',
  'defaultApAccountId',
  'defaultRevenueAccountId',
  'defaultExpenseAccountId',
  'defaultCostCenterId',
  'defaultActivityId'
]);

for (const file of files) {
  const fullPath = path.resolve(__dirname, '../../..', file);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes('Transform')) {
    content = content.replace(/import \{([\s\S]*?)\} from 'class-validator';/, "import {$1} from 'class-validator';\nimport { Transform } from 'class-transformer';");
  }

  const lines = content.split('\n');
  const newLines = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    newLines.push(line);
    
    // Look for @IsOptional()
    if (line.match(/^\s*@IsOptional\(\)/) || line.match(/^\s*@ApiPropertyOptional\(\)\s*@IsOptional\(\)/)) {
      // It's optional. Let's look ahead to see the field name and its type decorator.
      let j = i + 1;
      let hasTransform = false;
      let isNumberString = false;
      let fieldName = null;
      let fieldLineIdx = -1;
      
      while (j < lines.length && j < i + 5) { // Look ahead a few lines
        const lookahead = lines[j];
        if (lookahead.includes('@Transform')) {
          hasTransform = true;
        }
        if (lookahead.includes('@IsNumberString()')) {
          isNumberString = true;
        }
        const fieldMatch = lookahead.match(/^\s*([a-zA-Z0-9_]+)\?:/);
        if (fieldMatch) {
          fieldName = fieldMatch[1];
          fieldLineIdx = j;
          break;
        }
        j++;
      }
      
      if (fieldName && targetFields.has(fieldName) && !hasTransform) {
        // We found a target field that is missing a transform!
        const indent = lines[i].match(/^\s*/)[0];
        if (isNumberString) {
          newLines.push(`${indent}${transformStringify}`);
        } else {
          newLines.push(`${indent}${transformNull}`);
        }
      }
    }
    i++;
  }

  fs.writeFileSync(fullPath, newLines.join('\n'));
  console.log(`Updated ${file}`);
}
