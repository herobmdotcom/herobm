const fs = require('fs');
const path = 'apps/api/src/orders/shipment.service.ts';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const executeDispatchBody = lines.slice(299, 519).join('\n');

const executeDispatchMethod = `
  private async executeDispatch(
    innerTx: any,
    shipment: any,
    shipmentLines: any[],
    physicalStockLines: any[],
    actor: string,
  ) {
${executeDispatchBody}
  }
`;

// add executeDispatch at the end (before last '}')
lines.splice(lines.length - 2, 0, executeDispatchMethod);

// remove the draft->dispatched block and replace the else if
lines.splice(298, 523 - 298 + 1, "        if (shipment.stateCode === 'dispatched' && newState === 'cancelled') {");

// Fix createShipment stateCode
const text = lines.join('\n').replace(/stateCode: 'draft',/g, "stateCode: 'dispatched',");

fs.writeFileSync(path, text);
console.log('Done!');
