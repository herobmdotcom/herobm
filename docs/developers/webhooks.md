# Webhooks

Webhooks allow you to build custom integrations that react to events in HeroBM as they happen, rather than continuously polling the API for updates.

When an event occurs in HeroBM, the system will execute an HTTP POST payload to the webhook's configured target URL.

## Configuration

To create a webhook:

1. Go to **Configuration** ([http://localhost:4301/admin/developers](http://localhost:4301/admin/developers)).
2. Click *+ Add Webhook*.
3. Specify your **Target URL** (the endpoint on your server that will receive the payloads).
4. Select the **Events** you wish to subscribe to (e.g. `sales_order.created`, `payment.allocated`).

## Payload Format

The POST request will contain a JSON body with the event details:

```json
{
  "eventId": "uuid-v4",
  "eventType": "sales_order.created",
  "entityId": "uuid-of-the-order",
  "entityType": "sales_order",
  "timestamp": "2026-05-27T10:00:00Z",
  "payload": {
    "orderNumber": "SO-0001",
    "customerId": "uuid...",
    "lineCount": 3
  }
}
```

### Entity Types

The `entityType` field in the payload envelope indicates the domain object that triggered the event. HeroBM supports the following core entity types:

- **Sales**: `sales_order`, `sales_invoice`, `sales_return`
- **Procurement**: `purchase_order`, `purchase_invoice`, `purchase_return`
- **CRM**: `project`, `actor`, `contact`
- **Master Data**: `product`, `product_group`, `customer`, `customer_group`, `supplier`, `supplier_group`, `product_supplier`
- **Warehouse**: `warehouse` (covers receipts, shipments, picking, and putaway), `transfer_order`, `shipment`, `location`, `zone`, `bin`, `inventory_ledger`
- **Financials**: `payment`, `general_ledger`, `gl_account`, `gl_reconciliation`, `gl_match_group`, `bank_statement_line`, `reconciliation_rule`, `cost_center`, `exchange_rate`, `tax_category`, `tax_position`, `tax_position_mapping`
- **System**: `email`, `user`, `webhook`, `api_key`, `app_settings`, `gl_settings`, `system`, `activity`, `business_report`, `csv_mapping_profile`, `integration`, `macro`

### Event Types

The `eventType` is formed by combining the `entityType` and the action (e.g., `sales_order.created`). The following actions are supported:

- **Lifecycle Events**: `created`, `updated`, `deleted`, `archived`, `unarchived`
  - Fired during basic CRUD and visibility operations.
- **State Machine Events**: `status_changed`
  - Fired when an entity progresses through its workflow (e.g., Draft to Confirmed).
- **Business Operations**:
  - `processed`: Fired when a return or adjustment is finalized.
  - `dispatched` / `received`: Fired upon physical inventory movements.
  - `submitted` / `allocated` / `payment_cancelled`: Fired for payments.
  - `posted`: Fired when a journal entry is posted to the general ledger.

### Supported Events Matrix

| Entity Type | Supported Event Actions |
|-------------|--------------------------|
| `sales_order` | `created`, `status_changed`, `archived`, `unarchived`, `deleted`, `auto_status_changed`, `backorders_allocated`, `credit_note_posted`, `demand_allocated`, `demand_reallocated`, `demand_unallocated`, `post_confirmation_line_added`, `quote_generated`, `return_created`, `return_line_added`, `return_line_removed`, `return_line_updated`, `return_updated`, `sales_invoiced`, `tax_calculated`, `updated` |
| `sales_invoice` | `created`, `status_changed`, `deleted`, `credit_note_posted` |
| `sales_return` | `created`, `status_changed`, `processed`, `updated` |
| `purchase_order` | `created`, `status_changed`, `archived`, `unarchived`, `deleted`, `demand_allocated`, `demand_unallocated`, `invoice_matched`, `invoice_unmatched`, `return_created`, `updated` |
| `purchase_invoice` | `created`, `status_changed`, `deleted`, `order_linked`, `order_unlinked`, `updated` |
| `purchase_return` | `created`, `status_changed`, `processed` |
| `warehouse` | `receipt_created`, `receipt_status_changed`, `shipment_created`, `shipment_status_changed`, `shipment_dispatched`, `pick_created`, `pick_cancelled`, `putaway_completed`, `stock_moved` |
| `transfer_order` | `created`, `status_changed`, `deleted`, `stock_dispatched`, `updated` |
| `inventory_ledger` | `entry_posted` |
| `product` | `created`, `updated`, `deleted`, `archived`, `unarchived`, `status_changed`, `uom_added`, `uom_removed` |
| `product_group` | `created`, `updated`, `deleted` |
| `contact` | `created`, `updated`, `deleted` |
| `project` | `created`, `updated`, `deleted` |
| `actor` | `created`, `updated`, `deleted` |
| `customer` | `created`, `updated`, `archived`, `unarchived`, `status_changed` |
| `customer_group` | `created`, `updated`, `deleted` |
| `supplier` | `created`, `updated`, `archived`, `unarchived`, `added_expiry`, `deleted_expiry`, `status_changed`, `updated_expiry` |
| `supplier_group` | `created`, `updated`, `deleted` |
| `payment` | `submitted`, `allocated`, `payment_cancelled`, `payment_allocated`, `status_changed`, `created`, `updated` |
| `general_ledger` | `entry_posted` |
| `gl_reconciliation` | `created`, `updated`, `deleted` |
| `gl_match_group` | `created`, `deleted` |
| `bank_statement_line` | `created`, `updated`, `deleted` |
| `reconciliation_rule` | `created`, `updated`, `deleted` |
| `location` | `created`, `updated`, `deleted` |
| `tax_category` | `created`, `updated`, `deleted` |
| `tax_position` | `created`, `updated`, `deleted` |
| `tax_position_mapping` | `created`, `deleted` |
| `exchange_rate` | `created`, `updated`, `deleted` |
| `cost_center` | `created`, `updated`, `deleted` |
| `activity` | `created`, `updated`, `deleted` |
| `user` | `created`, `updated`, `deleted`, `status_changed` |
| `webhook` | `created`, `updated`, `deleted` |
| `app_settings` | `updated` |
| `gl_settings` | `updated` |
| `email` | `queued`, `sent`, `failed`, `dismissed` |
| `api_key` | `created`, `deleted` |
| `bin` | `created`, `deleted`, `updated` |
| `gl_account` | `created`, `updated` |
| `product_supplier` | `linked`, `unlinked` |
| `shipment` | `shipment_created`, `shipment_line_added`, `shipment_line_removed`, `shipment_line_updated`, `shipment_updated` |
| `system` | `receipt_matched`, `receipt_unmatched`, `updated` |
| `zone` | `created`, `deleted`, `updated` |
| `business_report` | `created`, `deleted`, `updated` |
| `csv_mapping_profile` | `created`, `deleted`, `updated` |
| `integration` | `updated` |
| `macro` | `created`, `deleted`, `updated` |

### State Changes Reference

When subscribing to \`status_changed\` events, the payload will contain the new status of the entity. The possible states for each entity type are:

- **Sales Order (\`sales_order\`)**: \`draft\`, \`quoted\`, \`confirmed\`, \`picking\`, \`shipped\`, \`invoiced\`, \`cancelled\`, \`archived\`, \`legacy\`
- **Sales Invoice (\`sales_invoice\`)**: \`draft\`, \`invoiced\`, \`partially_paid\`, \`paid\`, \`cancelled\`, \`archived\`, \`legacy\`
- **Sales Return (\`sales_return\`)**: \`draft\`, \`confirmed\`, \`partially_received\`, \`received\`, \`processed\`, \`cancelled\`
- **Purchase Order (\`purchase_order\`)**: \`draft\`, \`ordered\`, \`partially_received\`, \`received\`, \`invoiced\`, \`closed_short\`, \`cancelled\`, \`archived\`, \`legacy\`
- **Purchase Invoice (\`purchase_invoice\`)**: \`draft\`, \`invoiced\`, \`partially_paid\`, \`paid\`, \`cancelled\`, \`archived\`, \`legacy\`
- **Purchase Return (\`purchase_return\`)**: \`draft\`, \`staged\`, \`shipped\`, \`cancelled\`
- **Transfer Order (\`transfer_order\`)**: \`confirmed\`, \`picking\`, \`shipped\`, \`received\`, \`cancelled\`
- **Warehouse Receipt (\`warehouse\` - receipt)**: \`received\`, \`cancelled\`
- **Warehouse Shipment (\`warehouse\` - shipment)**: \`draft\`, \`dispatched\`, \`shipped\`, \`cancelled\`

## Security: Verifying Webhook Signatures

To ensure that the webhook was actually sent by HeroBM (and not a malicious third party), every webhook request includes a cryptographic signature in the `x-herobm-signature` header.

The signature is generated using a HMAC with SHA-256 algorithm.

### The Recommended Way: HeroBM SDK

The easiest way to consume webhooks and verify signatures is to use the `@herobm/sdk/server` Node.js package. It automatically handles HMAC verification and parses the standard envelope for you.

```javascript
const express = require('express');
const { HeroBM } = require('@herobm/sdk/server');

const app = new HeroBM({ webhookSecret: process.env.HEROBM_WEBHOOK_SECRET });

// 1. Hook into standard extension points natively
app.events.on('sales_order.created', async (event) => {
  console.log(\`Order \${event.entityId} was created!\`);
  console.log(\`Order Payload:\`, event.payload);
});

const server = express();

// 2. Mount the automated webhook receiver middleware
// IMPORTANT: You MUST use express.raw so the SDK receives the raw bytes for verification
server.use('/webhook', express.raw({ type: 'application/json' }), app.webhooks.expressMiddleware());

server.listen(3000, () => console.log('HeroBM Webhook Receiver started!'));
```

### Manual Verification Steps (Without SDK)

If you are not using Node.js or prefer to handle verification manually:

1. Get your webhook's **Secret Key** from the Developers page.
2. Read the raw, unparsed string body of the incoming HTTP request.
3. Compute the HMAC-SHA256 hash using the Secret Key and the raw body.
4. Compare your computed hash to the `x-herobm-signature` header.

## Retries

If your server responds with a non-2xx status code (e.g. 500 Internal Server Error) or times out, HeroBM will mark the webhook dispatch as failed. Currently, failed webhooks are not automatically retried but can be inspected by administrators. Ensure your webhook endpoint responds quickly (e.g., within 3 seconds) and defers heavy processing to a background worker.
