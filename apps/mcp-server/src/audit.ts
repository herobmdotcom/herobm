import { DOMAIN_MAP } from './index.js';
import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAudit() {
  const specPath = path.resolve(__dirname, '../../ops-portal/public/openapi.json');
  const apiSpec = await SwaggerParser.validate(specPath) as any;
  const tools = [];

  for (const pathItem of Object.values(apiSpec.paths || {})) {
    for (const op of Object.values(pathItem as any)) {
      const operation = op as any;
      if (!operation || !operation.operationId) continue;

      const tag = operation.tags?.[0] || 'Misc';
      const domain = DOMAIN_MAP[tag] || tag.toLowerCase().replace(/\s+/g, '_');
      
      const parts = operation.operationId.split('_');
      const methodPart = parts.length > 1 ? parts.slice(1).join('_') : operation.operationId;
      const snakeMethod = methodPart.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
      
      const controllerClass = operation.operationId.includes('_') ? operation.operationId.split('_')[0] : '';
      const controllerPrefix = controllerClass.replace(/Controller$/, '');
      let snakeController = controllerPrefix.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`).replace(/^_/, '');

      if (domain.endsWith('order') && snakeController.startsWith('order_')) {
        snakeController = snakeController.substring('order_'.length);
      }

      let toolName = `${domain}_${snakeController}_${snakeMethod.replace(/^_/, '')}`;
      
      const isPrimaryController = 
        (domain === 'sales_order' && snakeController === 'orders') ||
        (domain === 'purchase_order' && snakeController === 'purchase_orders') ||
        (domain === 'sales_invoice' && snakeController === 'sales_invoices') ||
        (domain === 'purchase_invoice' && snakeController === 'purchase_invoices') ||
        (domain === 'customer' && snakeController === 'customers') ||
        (domain === 'supplier' && snakeController === 'suppliers') ||
        (domain === 'product' && snakeController === 'products') ||
        (domain === 'warehouse' && snakeController === 'inventory') ||
        (domain === 'system' && snakeController === 'system') ||
        (domain === 'email' && snakeController === 'email') ||
        (snakeController === domain || snakeController === domain + 's');

      if (isPrimaryController) {
        toolName = `${domain}_${snakeMethod.replace(/^_/, '')}`;
      }
      
      tools.push(toolName);
    }
  }

  tools.sort();
  fs.writeFileSync('audit-tools.txt', tools.join('\n'));
  console.log(`Wrote ${tools.length} tools to audit-tools.txt`);
}

runAudit();
