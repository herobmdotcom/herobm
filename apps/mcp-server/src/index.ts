import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import SwaggerParser from '@apidevtools/swagger-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple locations for .env to ensure it loads when run by Antigravity or locally
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../../../.env'),
  'c:/Users/Marcel/volz/modbm/modbm/.env'
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.error(`Loaded env from ${p}`);
  }
}

const apiPort = process.env.PORT || process.env.API_PORT || '3001';
const API_URL = process.env.API_URL || `http://127.0.0.1:${apiPort}/api`;
const AGENT_KEY = process.env.HEROBM_AGENT_KEY;

interface ToolMeta {
  path: string;
  method: string;
  parameters: any[];
  requestBody?: any;
}

const toolRegistry = new Map<string, ToolMeta>();
const domainMap = new Map<string, Tool[]>();

export const DOMAIN_MAP: Record<string, string> = {
  'Sales Orders': 'sales_order',
  'Purchase Orders': 'purchase_order',
  'Sales Invoices': 'sales_invoice',
  'Purchase Invoices': 'purchase_invoice',
  'Sales Returns': 'sales_return',
  'Purchase Returns': 'purchase_return',
  'Transfer Orders': 'transfer_order',
  'Customers': 'customer',
  'Suppliers': 'supplier',
  'Products': 'product',
  'Warehouse': 'warehouse',
  'General Ledger': 'general_ledger',
  'System': 'system',
  'Payments': 'payment',
  'Contacts': 'contact',
  'Delivery Addresses': 'delivery_address',
  'Tax': 'tax'
};

async function main() {
  // Resolve spec path carefully
  let specPath = path.resolve(__dirname, '../../ops-portal/public/openapi.json');
  if (!fs.existsSync(specPath)) {
    specPath = path.resolve(process.cwd(), 'apps/ops-portal/public/openapi.json');
  }
  
  console.error(`Loading OpenAPI spec from ${specPath}`);
  
  // Parse and resolve all $refs
  const api = await SwaggerParser.validate(specPath);
  
  for (const [pathKey, pathItem] of Object.entries(api.paths || {})) {
    for (const [method, op] of Object.entries(pathItem as any)) {
      const operation = op as any;
      if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
      
      const operationId = operation.operationId;
      const description = operation.summary || operation.description || `Call ${operationId}`;
      
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      const parameters = operation.parameters || [];
      for (const param of parameters) {
        // MCP SDK requires valid JSON schema. We ensure no undefined schemas
        properties[param.name] = param.schema || { type: 'string' };
        if (param.description) {
          properties[param.name].description = param.description;
        }
        if (param.required) required.push(param.name);
      }
      
      let requestBody = operation.requestBody;
      if (requestBody?.content?.['application/json']?.schema) {
        const bodySchema = requestBody.content['application/json'].schema;
        properties['body'] = bodySchema;
        if (requestBody.required) required.push('body');
      }

      const toolDef: Tool = {
        name: operationId,
        description,
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {})
        }
      };
      
      const tag = operation.tags?.[0] || 'Misc';
      const domain = DOMAIN_MAP[tag] || tag.toLowerCase().replace(/\s+/g, '_');
      
      const parts = operationId.split('_');
      const methodPart = parts.length > 1 ? parts.slice(1).join('_') : operationId;
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

      // Also trim redundant prefixes (e.g., gl_create_account -> create_account)
      // Or sales_return_sales_credit_note -> sales_return_credit_note
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

      toolDef.name = toolName;
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push(toolDef);
      
      toolRegistry.set(toolName, {
        path: pathKey,
        method: method.toLowerCase(),
        parameters,
        requestBody
      });
    }
  }

  const domains = Array.from(domainMap.keys()).sort();
  const domainList = domains.join(', ');

  const mcpTools: Tool[] = [
    {
      name: 'list_database_tables',
      description: 'Lists all available database tables in the public schema',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_table_schema',
      description: 'Returns the exact columns, types, and foreign key relationships for a given PostgreSQL table.',
      inputSchema: {
        type: 'object',
        properties: { table_name: { type: 'string', description: 'Name of the table to inspect' } },
        required: ['table_name']
      }
    },
    {
      name: 'list_documentation_topics',
      description: 'Lists all available documentation topics from the docs/ directory',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'read_documentation',
      description: 'Reads the content of a specific documentation file from the docs/ directory',
      inputSchema: {
        type: 'object',
        properties: { file_path: { type: 'string', description: 'The path to the documentation file (e.g., developers/webhooks.md)' } },
        required: ['file_path']
      }
    },
    {
      name: 'list_webhook_events',
      description: 'Lists all available webhook event topics (e.g., sales_order.created)',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_webhook_payload_schema',
      description: 'Gets the payload schema and envelope structure for a given webhook event topic',
      inputSchema: {
        type: 'object',
        properties: { event_topic: { type: 'string', description: 'The event topic (e.g., sales_order.created)' } },
        required: ['event_topic']
      }
    },
    {
      name: 'list_api_domains',
      description: 'Lists all available API domains that can be passed to get_api_endpoints.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_api_endpoints',
      description: `Get available API endpoints for a given domain. Valid domains are: ${domainList}.`,
      inputSchema: {
        type: 'object',
        properties: { domain: { type: 'string', description: 'The domain to list endpoints for' } },
        required: ['domain']
      }
    },
    {
      name: 'call_herobm_api',
      description: 'Call a HeroBM API endpoint by its exact name returned by get_api_endpoints.',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint_name: { type: 'string', description: 'The exact endpoint name to call (e.g., purchase_order_create)' },
          arguments: { type: 'object', description: 'The arguments (path parameters, query parameters, body) for the endpoint as defined in its schema' }
        },
        required: ['endpoint_name']
      }
    },
    {
      name: 'list_build_targets',
      description: 'Lists all available Makefile build targets and their descriptions',
      inputSchema: { type: 'object', properties: {} }
    }
  ];

  console.error(`Registered ${toolRegistry.size} operations across ${domains.length} domains`);

  const server = new Server(
    { name: 'herobm-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: mcpTools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;
    
    if (name === 'get_table_schema') {
      try {
        const tableName = args?.table_name;
        if (!tableName) {
          return { isError: true, content: [{ type: 'text', text: 'table_name is required' }] };
        }
        
        const sql = postgres({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          database: process.env.POSTGRES_DB || 'postgres'
        });

        const columns = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema IN ('public', 'herobm_core') AND table_name = ${tableName}
          ORDER BY ordinal_position;
        `;

        const foreignKeys = await sql`
          SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
          FROM 
              information_schema.table_constraints AS tc 
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ${tableName};
        `;

        await sql.end();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                table: tableName,
                columns,
                foreign_keys: foreignKeys
              }, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Database error: ${err.message}` }]
        };
      }
    }

    if (name === 'list_build_targets') {
      try {
        const { execSync } = await import('child_process');
        const repoRoot = path.resolve(__dirname, '../../../');
        const output = execSync('make help', { cwd: repoRoot, encoding: 'utf-8' });
        return {
          content: [{ type: 'text', text: output }]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to run make help: ${err.message}` }]
        };
      }
    }

    if (name === 'list_api_domains') {
      return {
        content: [{ type: 'text', text: JSON.stringify(domains, null, 2) }]
      };
    }

    if (name === 'get_api_endpoints') {
      const domain = args?.domain;
      if (!domain) {
         return { isError: true, content: [{ type: 'text', text: 'domain is required' }] };
      }
      const tools = domainMap.get(domain);
      if (!tools) {
         return { isError: true, content: [{ type: 'text', text: `Unknown domain: ${domain}` }] };
      }
      return {
         content: [{ type: 'text', text: JSON.stringify(tools, null, 2) }]
      };
    }
    
    if (name === 'call_herobm_api') {
      const endpointName = args?.endpoint_name;
      const endpointArgs = args?.arguments || {};
      
      const meta = toolRegistry.get(endpointName);
      if (!meta) {
        return { isError: true, content: [{ type: 'text', text: `Unknown endpoint_name: ${endpointName}` }] };
      }

      try {
        let urlPath = meta.path;
        const queryParams = new URLSearchParams();
        
        for (const param of meta.parameters) {
          const val = endpointArgs?.[param.name];
          if (val !== undefined) {
            if (param.in === 'path') {
              urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(val)));
            } else if (param.in === 'query') {
              queryParams.append(param.name, String(val));
            }
          }
        }
        
        const queryString = queryParams.toString();
        const url = `${API_URL}${urlPath}${queryString ? '?' + queryString : ''}`;
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        if (AGENT_KEY) {
          headers['x-api-key'] = AGENT_KEY;
        }

        const axiosConfig = {
          method: meta.method,
          url,
          headers,
          data: endpointArgs?.['body']
        };

        console.error(`Executing MCP Tool: ${endpointName} -> ${meta.method.toUpperCase()} ${url}`);

        const response = await axios(axiosConfig);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      } catch (error: any) {
        const errorData = error.response?.data || error.message;
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `API Error: ${JSON.stringify(errorData, null, 2)}`
            }
          ]
        };
      }
    }

    if (name === 'list_database_tables') {
      try {
        const sql = postgres({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          database: process.env.POSTGRES_DB || 'postgres'
        });

        const tables = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema IN ('public', 'herobm_core') 
            AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `;
        
        await sql.end();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tables.map((t: any) => t.table_name), null, 2)
            }
          ]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Database error: ${err.message}` }] };
      }
    }

    if (name === 'list_webhook_events') {
      try {
        const url = `${API_URL}/webhooks/events`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (AGENT_KEY) headers['x-api-key'] = AGENT_KEY;

        const response = await axios({ method: 'GET', url, headers });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
      } catch (error: any) {
        return { isError: true, content: [{ type: 'text', text: `API Error: ${error.message}` }] };
      }
    }

    if (name === 'get_webhook_payload_schema') {
      try {
        const eventTopic = args?.event_topic;
        if (!eventTopic) return { isError: true, content: [{ type: 'text', text: 'event_topic is required' }] };

        // e.g., sales_order.created -> sales_orders
        const prefix = eventTopic.split('.')[0];
        // naive pluralization for table mapping:
        let tableName = prefix;
        if (prefix.endsWith('y')) tableName = prefix.slice(0, -1) + 'ies';
        else if (prefix === 'inventory') tableName = 'inventory'; // unpluralized
        else tableName = prefix + 's';

        const sql = postgres({
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          database: process.env.POSTGRES_DB || 'postgres'
        });

        const columns = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema IN ('public', 'herobm_core') AND table_name = ${tableName}
        `;
        await sql.end();

        const envelope = {
          eventType: eventTopic,
          payload: `[Object representing ${tableName} row]`
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                envelope,
                assumedTable: tableName,
                tableSchema: columns
              }, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }

    if (name === 'list_documentation_topics') {
      try {
        // Find docs/ directory by going up from apps/mcp-server
        const docsDir = path.resolve(__dirname, '../../../docs');
        const getFiles = (dir: string): string[] => {
          let results: string[] = [];
          if (!fs.existsSync(dir)) return results;
          const list = fs.readdirSync(dir);
          list.forEach(file => {
            file = path.join(dir, file);
            if (file.includes('continuous_improvement')) return;
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) results = results.concat(getFiles(file));
            else if (file.endsWith('.md') || file.endsWith('.mdx')) results.push(file);
          });
          return results;
        };

        const allDocs = getFiles(docsDir).map(p => path.relative(docsDir, p).replace(/\\/g, '/'));
        return {
          content: [{ type: 'text', text: JSON.stringify(allDocs, null, 2) }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }

    if (name === 'read_documentation') {
      try {
        let filePath = args?.file_path;
        if (!filePath) return { isError: true, content: [{ type: 'text', text: 'file_path is required' }] };
        
        // Strip leading/trailing quotes if they were mistakenly passed
        filePath = filePath.replace(/^["']|["']$/g, '');
        
        // Prevent directory traversal
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const docsDir = path.resolve(__dirname, '../../../docs');
        const absolutePath = path.resolve(docsDir, safePath);
        
        if (!fs.existsSync(absolutePath)) {
          return { isError: true, content: [{ type: 'text', text: `File not found: ${filePath}` }] };
        }
        
        const content = fs.readFileSync(absolutePath, 'utf8');
        return {
          content: [{ type: 'text', text: content }]
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }

    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool name: ${name}` }]
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HeroBM MCP Server running on stdio');
}

import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}
