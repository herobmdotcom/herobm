const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../../../apps/api/src/suppliers/dto.ts');
let content = fs.readFileSync(p, 'utf8');

const injection = `
  supplierGroupName?: string | null;
  supplierGroupCode?: string | null;
  supplierGroupTradingTermsId?: string | null;
  supplierGroupTaxPositionId?: string | null;
  supplierGroupEarlyPaymentDiscount?: string | null;
  supplierGroupEarlyPaymentDiscountDays?: number | null;
  supplierGroupCreditLimit?: string | null;
  groupIsPurchasingBlocked?: boolean;
  groupPurchasingBlockReason?: string | null;
  groupIsPaymentBlocked?: boolean;
  groupPaymentBlockReason?: string | null;`;

// Find `export class SupplierResponseDto {`
content = content.replace(
  'export class SupplierResponseDto {',
  'export class SupplierResponseDto {' + injection
);

fs.writeFileSync(p, content);
console.log('Fields injected!');
