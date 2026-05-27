const fs = require('fs');
const file = 'src/payments/payments.service.spec.ts';
let text = fs.readFileSync(file, 'utf8');
text = text.replace(/paymentType: '/g, "paymentId: 'mock-uuid-1',\n          paymentType: '");
fs.writeFileSync(file, text);
console.log('Replaced', text.includes('paymentId:'));
