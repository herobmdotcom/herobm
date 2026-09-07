---
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
1. Navigate to **Technical** → **Developers** (`/admin/developers`).
2. Scroll to the **Webhooks** section.
3. Click **+ Add Webhook**.
4. Enter your destination **Target URL** (e.g. `https://api.yourdomain.com/webhooks/herobm`).
5. Select the event types to subscribe to (e.g. `sales_order.*`, `payment.allocated`, or `*` for all events).
6. Copy and store the generated **Secret Key** (`whsec_...`) for HMAC signature validation.

---

## Payload Format & Envelope

Every webhook notification is delivered as an HTTP `POST` request with a JSON envelope:

```json
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
```

### Payload Envelope Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| **`eventId`** | UUID v4 | Unique identifier for the specific event occurrence (for deduplication). |
| **`eventType`** | String | Event identifier in `entity.action` format (e.g. `sales_order.created`). |
| **`entityId`** | UUID v4 | Primary key ID of the affected domain object. |
| **`entityType`** | String | Domain object classification (e.g. `sales_order`, `payment`). |
| **`entityDisplayName`** | String | Human-readable identifier or title of the domain entity (e.g. `SO-2026-00124`, `Acme Corp`). |
| **`timestamp`** | ISO 8601 | UTC timestamp when the event was recorded. |
| **`payload`** | Object | Structured business data relevant to the event. |

---

## Security & Signature Verification

Each webhook request includes an `x-herobm-signature` HTTP header containing an HMAC-SHA256 digest of the raw request payload. You should verify this signature using your webhook secret to confirm the request originated from HeroBM:

```typescript
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
```

---

## Supported Events Matrix

The following 186 event types are actively supported across 51 domain entity types:

| Entity Type | Supported Event Actions |
|-------------|--------------------------|
| `activity` | `created`, `deleted`, `updated` |
| `actor` | `created`, `deleted`, `updated` |
| `api_key` | `created`, `deleted` |
| `app_settings` | `updated` |
| `bank_statement_line` | `created`, `deleted`, `updated` |
| `bin` | `created`, `deleted`, `updated` |
| `business_report` | `created`, `deleted`, `updated` |
| `contact` | `created`, `deleted`, `updated` |
| `cost_center` | `created`, `deleted`, `updated` |
| `crm_activity` | `created`, `deleted`, `status_changed`, `updated` |
| `csv_mapping_profile` | `created`, `deleted`, `updated` |
| `customer` | `archived`, `created`, `status_changed`, `unarchived`, `updated` |
| `customer_group` | `created`, `deleted`, `updated` |
| `email` | `dismissed`, `queued` |
| `exchange_rate` | `created`, `deleted`, `updated` |
| `fiscal_period` | `created`, `status_changed`, `updated` |
| `general_ledger` | `entry_posted` |
| `gl_account` | `created`, `updated` |
| `gl_match_group` | `created`, `deleted` |
| `gl_reconciliation` | `created`, `deleted`, `updated` |
| `gl_settings` | `updated` |
| `integration` | `updated` |
| `inventory_ledger` | `entry_posted` |
| `location` | `created`, `deleted`, `updated` |
| `macro` | `created`, `deleted`, `updated` |
| `opportunity` | `created`, `deleted`, `updated` |
| `payment` | `created`, `payment_allocated`, `payment_cancelled`, `status_changed`, `updated` |
| `product` | `archived`, `created`, `status_changed`, `unarchived`, `uom_added`, `uom_removed`, `updated` |
| `product_group` | `created`, `deleted`, `updated` |
| `product_supplier` | `linked`, `unlinked` |
| `purchase_invoice` | `status_changed`, `updated` |
| `purchase_order` | `archived`, `created`, `debit_note_created`, `debit_note_posted`, `demand_allocated`, `demand_unallocated`, `invoice_matched`, `invoice_unmatched`, `return_created`, `status_changed`, `unarchived`, `updated` |
| `purchase_return` | `created`, `status_changed` |
| `reconciliation_rule` | `created`, `deleted`, `updated` |
| `sales_invoice` | `credit_note_posted`, `status_changed` |
| `sales_order` | `archived`, `auto_status_changed`, `backorders_allocated`, `created`, `credit_note_posted`, `demand_allocated`, `demand_reallocated`, `demand_unallocated`, `post_confirmation_line_added`, `return_created`, `return_line_added`, `return_line_removed`, `return_line_updated`, `return_updated`, `sales_invoiced`, `status_changed`, `tax_calculated`, `unarchived`, `updated` |
| `sales_return` | `created`, `status_changed`, `updated` |
| `shipment` | `shipment_created`, `shipment_line_added`, `shipment_line_removed`, `shipment_line_updated`, `shipment_updated` |
| `supplier` | `added_expiry`, `archived`, `created`, `debit_note_posted`, `deleted_expiry`, `status_changed`, `unarchived`, `updated`, `updated_expiry` |
| `supplier_group` | `created`, `deleted`, `updated` |
| `system` | `ledger_integrity_violation`, `receipt_matched`, `receipt_unmatched`, `updated` |
| `tax_category` | `created`, `deleted`, `updated` |
| `tax_position` | `created`, `deleted`, `updated` |
| `tax_position_mapping` | `created`, `deleted` |
| `transfer_order` | `created`, `status_changed`, `stock_dispatched`, `updated` |
| `user` | `created`, `deleted`, `status_changed`, `updated` |
| `warehouse` | `pick_cancelled`, `pick_created`, `putaway_completed`, `receipt_created`, `receipt_status_changed`, `shipment_dispatched`, `shipment_status_changed`, `stock_moved`, `updated` |
| `webhook` | `created`, `deleted`, `updated` |
| `work_order` | `created`, `demand_allocated`, `status_changed`, `updated` |
| `work_order_pick` | `created`, `pick_cancelled`, `status_changed` |
| `zone` | `created`, `deleted`, `updated` |

---

## CRM Domain Events & Webhook Schemas

HeroBM provides real-time webhook events across CRM commercial pipelines, stakeholder contacts, and human interactions.

### 1. Opportunity Events (`opportunity.*`)

Commercial opportunities trigger lifecycle events across deal stages, value adjustments, and stakeholder changes.

| Event Type | Trigger Description | Key Payload Attributes |
| :--- | :--- | :--- |
| **`opportunity.created`** | New commercial deal created via UI or API. | `opportunityId`, `opportunityName`, `action: "opportunity_created"` |
| **`opportunity.updated`** | Pipeline stage changed, estimated/actual value updated, win probability modified, or deal notes/contacts linked. | `opportunityId`, `opportunityName`, `action: "opportunity_updated"` (or `"opportunity_contact_linked"`, `"opportunity_contact_unlinked"`, `"opportunity_archived"`, `"opportunity_unarchived"`) |
| **`opportunity.deleted`** | Opportunity record deleted. | `opportunityId`, `opportunityName`, `action: "opportunity_deleted"` |

#### Sample Payload: `opportunity.created`
```json
{
  "eventId": "a7b3c2d1-e4f5-4a6b-8c9d-0e1f2a3b4c5d",
  "eventType": "opportunity.created",
  "entityId": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
  "entityType": "opportunity",
  "entityDisplayName": "Opportunity",
  "timestamp": "2026-09-04T10:30:00.000Z",
  "payload": {
    "action": "opportunity_created",
    "opportunityId": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "opportunityName": "Sydney Metro HVAC Modernization"
  }
}
```

---

### 2. CRM Activity & Task Events (`crm_activity.*`)

CRM activities track human customer interactions (phone calls, emails, meetings, notes) and scheduled follow-up tasks.

| Event Type | Trigger Description | Key Payload Attributes |
| :--- | :--- | :--- |
| **`crm_activity.created`** | New interaction or task recorded. | `activityId`, `activityType`, `subject`, `status`, `priority`, `actorId`, `contactIds` (array of attendee UUIDs), `projectId` (opportunity ID), `dueDate`, `assignedToUserId` |
| **`crm_activity.updated`** | Activity details, subject, description, priority, or attendee contacts modified. | `activityId`, `changes` |
| **`crm_activity.status_changed`** | Follow-up task marked as completed or reopened. | `activityId`, `previousStatus`, `newStatus`, `action` (`"crm_activity_completed"` or `"crm_activity_reopened"`) |
| **`crm_activity.deleted`** | Activity or task deleted. | `activityId`, `type`, `subject`, `action: "crm_activity_deleted"` |

#### Multi-Contact Attendee Association (`contactIds`)
Activities support associating multiple contacts simultaneously via `crm_activity_contacts`. The `contactIds` array in the `crm_activity.created` payload catalogs all participating attendees (e.g. multi-stakeholder client meetings or team discovery calls).

#### Automatic Opportunity Contact Linking
When an activity linked to an Opportunity (`projectId`) includes contacts, those contacts are automatically registered into the Opportunity's stakeholder contact directory (`opportunity_contacts`) without duplicate entry.

#### Cross-Entity Audit Trails
When an activity is logged:
1. The primary event is emitted under `crm_activity.created`.
2. If linked to an Actor, an update audit event (`actor.updated`) is emitted against the Actor with activity summary metadata.
3. If contacts are linked (`contactIds`), an update audit event (`contact.updated`) is emitted against each participating Contact.
4. If linked to an Opportunity (`projectId`), an update audit event (`opportunity.updated`) is emitted against the Opportunity.

#### Sample Payload: `crm_activity.created` (Meeting with Multiple Attendees)
```json
{
  "eventId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
  "eventType": "crm_activity.created",
  "entityId": "8f14e45f-da98-4cf2-8356-9a2d3c4e5b6a",
  "entityType": "crm_activity",
  "entityDisplayName": "MEETING: Discovery & Scope Review",
  "timestamp": "2026-09-04T11:00:00.000Z",
  "payload": {
    "action": "crm_activity_logged",
    "activityId": "8f14e45f-da98-4cf2-8356-9a2d3c4e5b6a",
    "activityType": "meeting",
    "subject": "Discovery & Scope Review",
    "status": "scheduled",
    "priority": "high",
    "actorId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "contactIds": [
      "c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
      "d2e3f4a5-6b7c-8d9e-0f1a-2b3c4d5e6f7a"
    ],
    "projectId": "e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
    "dueDate": "2026-09-10T09:00:00.000Z",
    "assignedToUserId": "u1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c"
  }
}
```

#### Sample Payload: `crm_activity.status_changed` (Task Completed)
```json
{
  "eventId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
  "eventType": "crm_activity.status_changed",
  "entityId": "8f14e45f-da98-4cf2-8356-9a2d3c4e5b6a",
  "entityType": "crm_activity",
  "entityDisplayName": "TASK: Follow up on contract signature",
  "timestamp": "2026-09-04T11:15:00.000Z",
  "payload": {
    "action": "crm_activity_completed",
    "activityId": "8f14e45f-da98-4cf2-8356-9a2d3c4e5b6a",
    "previousStatus": "open",
    "newStatus": "completed"
  }
}
```

---

### 3. Actor & Contact Events (`actor.*`, `contact.*`)

- **`actor.*`: Unified Business Entity Lifecycle**
  - `actor.created`, `actor.updated`, `actor.deleted`
  - Emitted when business account details, account ownership (`owner_id`), corporate hierarchy links (`parent_company`, `subsidiary`, `partner`), or trading accounts (Customer/Supplier) are configured.
- **`contact.*`: Contacts & Affiliations**
  - `contact.created`, `contact.updated`, `contact.deleted`
  - Emitted when contact personnel profiles, multi-company affiliations, or document dispatch routing tags (`primary_for`: `billing`, `shipping`, `purchasing`, `sales`, `general`) are modified.

---

## Delivery Retries & Resilience

1. **Success Expectation**: Your endpoint must respond with an HTTP `2xx` status code within 10 seconds.
2. **Exponential Backoff**: If your server responds with an error (4xx/5xx) or times out, HeroBM automatically retries delivery with exponential backoff (up to 5 attempts).
3. **Event Queue Inspection**: View delivery statuses, response latencies, and retry failed webhooks under **Technical** → **System Health** → **Event Queue** (`/admin/event-queue`).
