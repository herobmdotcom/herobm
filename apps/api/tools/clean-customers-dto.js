const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../../apps/api/src/customers/dto.ts');
let content = fs.readFileSync(p, 'utf8');

const linesToRemove = [
  'customerGroupName?: string;',
  'customerGroupCode?: string;',
  'customerGroupTradingTermsId?: string;',
  'customerGroupCreditLimit?: string;',
  'customerGroupIsOnCreditHold?: boolean;',
  'gstCategoryName?: string;'
];

const newContent = content.split('\n').filter(line => {
  return !linesToRemove.some(toRemove => line.includes(toRemove));
}).join('\n');

fs.writeFileSync(p, newContent);
console.log('Cleaned up AccountResponseDto');
