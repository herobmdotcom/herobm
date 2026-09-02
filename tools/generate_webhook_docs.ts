import * as fs from 'fs';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..');
const sourceFile = path.join(projectRoot, 'packages/shared/src/event-types.ts');
const userDocFile = path.join(projectRoot, 'docs/user/webhooks_api.md');
const devDocFile = path.join(projectRoot, 'docs/developers/webhooks.md');

function extractOutboxEvents(source: string): string[] {
  const regex = /OUTBOX_EVENT_TYPES:\s*ReadonlySet<string>\s*=\s*new\s*Set\(\[([\s\S]*?)\]\);/;
  const match = source.match(regex);
  if (!match) {
    throw new Error('Could not find OUTBOX_EVENT_TYPES in ' + sourceFile);
  }

  const arrayContent = match[1];
  const events: string[] = [];
  const eventRegex = /'([^']+)'/g;
  let m;
  while ((m = eventRegex.exec(arrayContent)) !== null) {
    events.push(m[1]);
  }
  return events;
}

function generateMarkdown(events: string[]): string {
  // Group by entity
  const entityMap: Record<string, string[]> = {};
  for (const evt of events) {
    const [entity, action] = evt.split('.');
    if (!entity || !action) continue;
    if (!entityMap[entity]) {
      entityMap[entity] = [];
    }
    entityMap[entity].push(action);
  }

  // Sort entities alphabetically
  const sortedEntities = Object.keys(entityMap).sort();

  const tableRows = sortedEntities.map((entity) => {
    const actions = entityMap[entity].sort().map((a) => `\`${a}\``).join(', ');
    return `| \`${entity}\` | ${actions} |`;
  }).join('\n');

  return `---
id: webhooks-api
title: "Webhooks API Reference"
description: "Real-time event subscriptions, payload schemas, event matrix, signature verification, and delivery retry policies."
category: "Developer"
order: 3
resource: "developers"
action: "read"
routes:
  - "/admin/developers"
tags: ["webhooks", "api", "events", "integration", "outbox", "developers", "hmac"]
---

# Webhooks API Reference

Webhooks allow external applications to receive real-time HTTP POST notifications when state changes or operational events occur in HeroBM.

---

## Configuration & Subscription

To create and manage webhook endpoints:
1. Navigate to **Technical** → **Developers** (\`/admin/developers\`).
2. Scroll to the **Webhooks** section.
3. Click **+ Add Webhook**.
4. Enter your destination **Target URL** (e.g. \`https://api.yourdomain.com/webhooks/herobm\`).
5. Select the event types to subscribe to (e.g. \`sales_order.*\`, \`payment.allocated\`, or \`*\` for all events).
6. Copy and store the generated **Secret Key** (\`whsec_...\`) for HMAC signature validation.

---

## Payload Format & Envelope

Every webhook notification is delivered as an HTTP \`POST\` request with a JSON envelope:

\`\`\`json
{
  "eventId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "eventType": "sales_order.status_changed",
  "entityId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "entityType": "sales_order",
  "entityDisplayName": "SO-2026-00124",
  "timestamp": "2026-08-19T12:00:00.000Z",
  "payload": {
    "orderNumber": "SO-2026-00124",
    "previousState": "draft",
    "newState": "confirmed",
    "customerId": "f8586ef0-bbc3-4af8-9c00-7b40dc25bbae",
    "totalAmount": 12450.00,
    "currencyCode": "AUD"
  }
}
\`\`\`

### Payload Envelope Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| **\`eventId\`** | UUID v4 | Unique identifier for the specific event occurrence (for deduplication). |
| **\`eventType\`** | String | Event identifier in \`entity.action\` format (e.g. \`sales_order.created\`). |
| **\`entityId\`** | UUID v4 | Primary key ID of the affected domain object. |
| **\`entityType\`** | String | Domain object classification (e.g. \`sales_order\`, \`payment\`). |
| **\`entityDisplayName\`** | String | Human-readable identifier or title of the domain entity (e.g. \`SO-2026-00124\`, \`Acme Corp\`). |
| **\`timestamp\`** | ISO 8601 | UTC timestamp when the event was recorded. |
| **\`payload\`** | Object | Structured business data relevant to the event. |

---

## Security & Signature Verification

Each webhook request includes an \`x-herobm-signature\` HTTP header containing an HMAC-SHA256 digest of the raw request payload. You should verify this signature using your webhook secret to confirm the request originated from HeroBM:

\`\`\`typescript
import * as crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secretKey: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody, 'utf-8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}
\`\`\`

---

## Supported Events Matrix

The following ${events.length} event types are actively supported across ${sortedEntities.length} domain entity types:

| Entity Type | Supported Event Actions |
|-------------|--------------------------|
${tableRows}

---

## Delivery Retries & Resilience

1. **Success Expectation**: Your endpoint must respond with an HTTP \`2xx\` status code within 10 seconds.
2. **Exponential Backoff**: If your server responds with an error (4xx/5xx) or times out, HeroBM automatically retries delivery with exponential backoff (up to 5 attempts).
3. **Event Queue Inspection**: View delivery statuses, response latencies, and retry failed webhooks under **Technical** → **System Health** → **Event Queue** (\`/admin/event-queue\`).
`;
}

function run() {
  console.log('Generating Webhook Documentation from event-types.ts...');
  const source = fs.readFileSync(sourceFile, 'utf-8');
  const events = extractOutboxEvents(source);
  const markdown = generateMarkdown(events);

  fs.writeFileSync(devDocFile, markdown, 'utf-8');
  console.log(`✅ Generated ${devDocFile} (${events.length} events)`);

  if (fs.existsSync(userDocFile)) {
    fs.writeFileSync(userDocFile, markdown, 'utf-8');
  }
}

run();
