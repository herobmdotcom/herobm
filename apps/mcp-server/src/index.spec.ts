import { DOMAIN_MAP } from './index.js';
import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import { test } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('MCP Server Structural Integrity', async (t) => {
  const specPath = path.resolve(__dirname, '../../ops-portal/public/openapi.json');
  const apiSpec = await SwaggerParser.validate(specPath) as any;

  await t.test('should explicitly map all OpenAPI tags to a DOMAIN_MAP entry', () => {
    const unmappedTags = new Set<string>();

    for (const pathItem of Object.values(apiSpec.paths || {})) {
      for (const op of Object.values(pathItem as any)) {
        const operation = op as any;
        if (!operation || !operation.operationId) continue;

        const tag = operation.tags?.[0];
        if (tag && !DOMAIN_MAP[tag]) {
          unmappedTags.add(tag);
        }
      }
    }

    if (unmappedTags.size > 0) {
      console.warn(`Unmapped tags falling back to auto-formatting: ${Array.from(unmappedTags).join(', ')}`);
    }

    assert.deepStrictEqual(Array.from(unmappedTags), [], 'All OpenAPI tags must be explicitly mapped in DOMAIN_MAP to ensure singular convention');
  });

  await t.test('should generate completely unique tool names without collisions', () => {
    const generatedToolNames = new Set<string>();
    const collisions = new Set<string>();

    const nativeTools = new Set([
      'list_build_targets',
      'list_api_domains',
      'get_table_schema',
      'get_api_endpoints',
      'call_herobm_api',
      'list_webhook_events',
      'get_webhook_payload_schema',
      'list_database_tables',
      'list_documentation_topics',
      'read_documentation'
    ]);

    for (const pathItem of Object.values(apiSpec.paths || {})) {
      for (const op of Object.values(pathItem as any)) {
        const operation = op as any;
        if (!operation || !operation.operationId) continue;

        const tag = operation.tags?.[0] || 'Misc';
        const domain = DOMAIN_MAP[tag] || tag.toLowerCase().replace(/\s+/g, '_');
        
        const operationId = operation.operationId;
        const methodPart = operationId.includes('_') ? operationId.split('_')[1] : operationId;
        const snakeMethod = methodPart.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
        
        const controllerClass = operationId.includes('_') ? operationId.split('_')[0] : '';
        const controllerPrefix = controllerClass.replace(/Controller$/, '');
        let snakeController = controllerPrefix.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`).replace(/^_/, '');

        if (!snakeController.endsWith('ss') && !snakeController.endsWith('us') && !snakeController.endsWith('is')) {
          if (snakeController.endsWith('ies')) {
            snakeController = snakeController.slice(0, -3) + 'y';
          } else if (snakeController.endsWith('s')) {
            snakeController = snakeController.slice(0, -1);
          }
        }

        if (domain.endsWith('order') && snakeController.startsWith('order_')) {
          snakeController = snakeController.substring('order_'.length);
        }

        if (domain === 'general_ledger' && snakeController === 'gl') {
          snakeController = '';
        } else if (snakeController.startsWith(domain + '_')) {
          snakeController = snakeController.substring((domain + '_').length);
        } else {
          const firstWordOfDomain = domain.split('_')[0];
          if (firstWordOfDomain && snakeController.startsWith(firstWordOfDomain + '_')) {
            snakeController = snakeController.substring((firstWordOfDomain + '_').length);
          }
        }

        let toolName = snakeController ? `${domain}_${snakeController}_${snakeMethod.replace(/^_/, '')}` : `${domain}_${snakeMethod.replace(/^_/, '')}`;
        
        const isPrimaryController = 
          (domain === 'sales_order' && snakeController === 'order') ||
          (domain === 'purchase_order' && snakeController === 'purchase_order') ||
          (domain === 'sales_invoice' && snakeController === 'sales_invoice') ||
          (domain === 'purchase_invoice' && snakeController === 'purchase_invoice') ||
          (domain === 'customer' && snakeController === 'customer') ||
          (domain === 'supplier' && snakeController === 'supplier') ||
          (domain === 'product' && snakeController === 'product') ||
          (domain === 'warehouse' && snakeController === 'inventory') ||
          (domain === 'system' && snakeController === 'system') ||
          (domain === 'email' && snakeController === 'email') ||
          (snakeController === domain || snakeController === domain + 's');

        if (isPrimaryController) {
          toolName = `${domain}_${snakeMethod.replace(/^_/, '')}`;
        }

        if (generatedToolNames.has(toolName) || nativeTools.has(toolName)) {
          console.error(`Collision detected for toolName: ${toolName}. Current operationId: ${operationId}`);
          collisions.add(toolName);
        }
        generatedToolNames.add(toolName);
      }
    }

    assert.deepStrictEqual(Array.from(collisions), [], 'Tool names must be completely unique and not collide with native tools');
  });
});
