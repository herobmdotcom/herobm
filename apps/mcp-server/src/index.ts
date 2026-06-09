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

dotenv.config();

const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';
const AGENT_KEY = process.env.MODBM_AGENT_KEY;

interface ToolMeta {
  path: string;
  method: string;
  parameters: any[];
  requestBody?: any;
}

const toolRegistry = new Map<string, ToolMeta>();

async function main() {
  // Resolve spec path carefully
  let specPath = path.resolve(__dirname, '../../ops-portal/public/openapi.json');
  if (!fs.existsSync(specPath)) {
    specPath = path.resolve(process.cwd(), 'apps/ops-portal/public/openapi.json');
  }
  
  console.error(`Loading OpenAPI spec from ${specPath}`);
  
  // Parse and resolve all $refs
  const api = await SwaggerParser.validate(specPath);
  
  const mcpTools: Tool[] = [];

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

      mcpTools.push({
        name: operationId,
        description,
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {})
        }
      });
      
      toolRegistry.set(operationId, {
        path: pathKey,
        method: method.toLowerCase(),
        parameters,
        requestBody
      });
    }
  }

  mcpTools.push({
    name: 'list_build_targets',
    description: 'Lists all available Makefile build targets and their descriptions',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  });

  mcpTools.push({
    name: 'get_table_schema',
    description: 'Returns the exact columns, types, and foreign key relationships for a given PostgreSQL table.',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Name of the table to inspect'
        }
      },
      required: ['table_name']
    }
  });

  console.error(`Registered ${mcpTools.length} tools from OpenAPI spec and custom tools`);

  const server = new Server(
    { name: 'modbm-mcp-server', version: '0.1.0' },
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
          WHERE table_schema = 'public' AND table_name = ${tableName}
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

    const meta = toolRegistry.get(name);
    
    if (!meta) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      let urlPath = meta.path;
      const queryParams = new URLSearchParams();
      
      for (const param of meta.parameters) {
        const val = args?.[param.name];
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
        data: args?.['body']
      };

      console.error(`Executing MCP Tool: ${name} -> ${meta.method.toUpperCase()} ${url}`);

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
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ModBM MCP Server running on stdio');
}

main().catch(console.error);
