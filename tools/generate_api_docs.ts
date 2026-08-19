import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..');
const openApiFile = path.join(projectRoot, 'docs/developers/openapi.json');
const userDocFile = path.join(projectRoot, 'docs/user/api_reference.md');

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
  }>>;
  tags?: Array<{ name: string; description?: string }>;
}

function run() {
  console.log('Generating API Reference Documentation from openapi.json...');
  if (!fs.existsSync(openApiFile)) {
    console.error(`❌ ${openApiFile} not found. Run 'make dev-docs-api' first.`);
    process.exit(1);
  }

  const spec: OpenApiSpec = JSON.parse(fs.readFileSync(openApiFile, 'utf-8'));

  // Group endpoints by tag
  const tagMap: Record<string, Array<{ method: string; path: string; summary: string }>> = {};

  for (const [routePath, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
        const tag = (op.tags && op.tags.length > 0) ? op.tags[0] : 'General';
        if (!tagMap[tag]) {
          tagMap[tag] = [];
        }
        tagMap[tag].push({
          method: method.toUpperCase(),
          path: routePath,
          summary: op.summary || op.description || '',
        });
      }
    }
  }

  const sortedTags = Object.keys(tagMap).sort();

  let tagSections = '';
  for (const tag of sortedTags) {
    const endpoints = tagMap[tag];
    const rows = endpoints.map((ep) => `| \`${ep.method}\` | \`${ep.path}\` | ${ep.summary.replace(/\|/g, '\\|')} |`).join('\n');
    tagSections += `\n### ${tag}\n\n| Method | Endpoint | Description |\n| :--- | :--- | :--- |\n${rows}\n`;
  }

  const totalEndpoints = Object.values(tagMap).reduce((acc, arr) => acc + arr.length, 0);

  const markdown = `---
id: api-reference
title: "REST API Reference"
description: "RESTful API documentation, authentication, rate limits, error schemas, and endpoint catalog."
category: "Technical"
order: 33
resource: "system"
action: "read"
routes:
  - "/admin/developers"
tags: ["api", "rest", "swagger", "openapi", "endpoints", "developers", "integration"]
---

# REST API Reference

The HeroBM REST API provides programmatic access to master data, operational documents (Sales Orders, Invoices, Shipments, Purchase Orders), and financial ledgers.

---

## Authentication & Headers

All API requests (except public health checks) require a valid **API Key** or **Bearer JWT Token** in the \`Authorization\` HTTP header:

\`\`\`http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
\`\`\`

### Generating API Keys
1. Go to **Technical** → **Developers** (\`/admin/developers\`).
2. In the **API Keys** section, click **+ Add Key**.
3. Select an assigned role (e.g. \`agent\`, \`viewer\`, or \`admin\`).
4. Copy the generated secret key.

---

## Interactive Swagger Documentation

An interactive OpenAPI / Swagger UI test workbench is available on the running API server:
- **Interactive Documentation**: [\`/api/docs\`](/api/docs)
- **OpenAPI 3.0 JSON Specification**: [\`/docs/developers/openapi.json\`](/api/docs-json)

---

## Rate Limits & Error Handling

- **Rate Limits**: By default, requests are limited to **1,000 requests per minute** per API key (configurable in Developer Settings).
- **HTTP Status Codes**:
  - \`200 OK\` / \`201 Created\`: Request succeeded.
  - \`400 Bad Request\`: Malformed request body or schema validation error.
  - \`401 Unauthorized\`: Missing or invalid API key.
  - \`403 Forbidden\`: Insufficient role permissions for the requested resource.
  - \`404 Not Found\`: Entity or endpoint not found.
  - \`429 Too Many Requests\`: Rate limit exceeded.

---

## Core Endpoint Catalog (${totalEndpoints} Endpoints Across ${sortedTags.length} Domains)
${tagSections}
`;

  fs.writeFileSync(userDocFile, markdown, 'utf-8');
  console.log(`✅ Generated ${userDocFile} (${totalEndpoints} endpoints)`);
}

run();
