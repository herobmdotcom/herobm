---
id: technical-operations
title: "Developers, Outbox & System Health"
description: "Manage API keys, Webhooks, rate limits, email SMTP outbox, legacy database imports (ABM/Odoo/CSV), and system diagnostics."
category: "Technical"
order: 30
resource: "system"
action: "read"
routes:
  - "/admin/developers"
  - "/admin/email/outbox"
  - "/admin/email/settings"
  - "/admin/import/csv"
  - "/admin/import/abm"
  - "/admin/import/odoo"
  - "/admin/event-queue"
  - "/admin/system-logs"
  - "/admin/version"
tags: ["developers", "api", "webhooks", "email", "outbox", "import", "health", "logs", "rate-limits", "security"]
fields:
  key_hash:
    title: "API Key Hash"
    summary: "Bcrypt (cost 10) salted cryptographic hash of the access token stored in the database."
  prefix:
    title: "API Key Prefix"
    summary: "Public prefix used to identify tokens without storing cleartext."
  target_url:
    title: "Webhook Endpoint"
    summary: "Destination HTTPS URL receiving real-time JSON event payloads."
  event_type:
    title: "Outbox Event Type"
    summary: "Domain event name (e.g. sales_order.status_changed, payment.allocated)."
  import_source:
    title: "Data Import Source"
    summary: "Migration source: CSV Files, Legacy ABM Database, or Odoo Database."
related:
  - "import-pipelines"
  - "admin-settings"
  - "admin-users"
  - "api-reference"
  - "webhooks-api"
---

# Developers, Outbox & System Health

The **Technical** section provides enterprise tools for developer API key management, real-time Webhook event streaming, rate limit controls, outbound email delivery queues, database migrations, data import pipelines, and live system diagnostics.

---

## Technical Architecture & Outbox Worker

```mermaid
flowchart LR
    A[Business Action e.g. Order Confirmed] --> B[Atomic Transaction + Outbox Event]
    B --> C[Transactional herobm_core.outbox Table]
    C --> D[Outbox Dispatch Worker]
    D --> E[HTTP Webhook Endpoints]
    D --> F[SMTP Email Delivery Engine]
    D --> G[Audit Event Stream]
```

### 1. API Security & Key Hashing Architecture
* **Cryptographic Token Generation**: API keys are generated using 32 bytes of cryptographically secure random entropy (`randomBytes(32).toString('hex')`).
* **One-Time Secret Presentation**: The plaintext token is presented to the user **exactly once** in the secure Secret Modal.
* **Bcrypt Hash Storage**: The database stores only a **bcrypt hash (cost 10)** (`key_hash`) and an identification prefix (`prefix`). Incoming requests verify the token against `key_hash` using standard bcrypt comparison.

### 2. Rate Limiting & Granular Route Throttling
* **Default Throughput**: Protected by Throttler guards with sensible route limits (e.g. 120 req/min default, 5 req/min on `/auth/login`, 30 req/min on `/auth/me`).
* **Sliding Window Algorithm**: Tracks request velocity in rolling 60-second intervals.
* **429 Response Guardrail**: When an integration exceeds its quota, the API rejects requests with HTTP `429 Too Many Requests` and supplies a `Retry-After: <seconds>` response header.

### 3. Outbox Dispatch & SMTP Queue
* **Transactional Guarantee**: Outbound notifications and emails are written directly to database outbox tables (`herobm_core.outbox`, `herobm_core.email_outbox`) in the same database transaction as business mutations.
* **Continuous Event-Driven Relay**: Background workers process pending records via PostgreSQL `LISTEN/NOTIFY` and concurrency locks, ensuring at-least-once delivery with exponential retry backoff.

### 4. Database-Level Immutability Architecture
HeroBM enforces unconditional PostgreSQL `BEFORE DELETE` triggers (`herobm_core.prevent_financial_deletion`) across three compliance tiers:
* **Tier 1 (Perpetual Inventory & Bank Control)**: `inventory_ledger`, `goods_received`, `sales_order_shipments`, `transfer_order_shipments`, `bank_statement_lines`, `gl_reconciliations`, `gl_match_groups`.
* **Tier 2 (Universal Domain Audit Logs)**: `procurement_events`, `inventory_events`, `warehouse_events`, `master_data_events`, `user_events`, `reconciliation_events`, `group_events`, `email_events`, `business_report_events`, `integration_events`.
* **Tier 3 (Historical Financial Parameters)**: `exchange_rates`, `gl_fiscal_periods`.

---

## Step-by-Step Workflows

### 1. Generating an API Key
1. Go to **Technical** → **Developers** (`/admin/developers`).
2. In the **API Keys** section, click **Generate API Key**.
3. Enter a **Key Name** and select the assigned **Role** (e.g. `agent` or `admin`).
4. Click **Create Key**. Copy the generated secret key immediately from the **Secret Modal** (it cannot be retrieved again).

### 2. Registering a Webhook Subscription
1. In **Developers** (`/admin/developers`), scroll to the **Webhooks** card.
2. Click **Add Webhook**.
3. Enter the destination **Endpoint URL** (must be HTTPS) and select the subscribed **Event Topics**.
4. Save the subscription. The system begins streaming JSON payloads immediately upon event emission.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **API Key Name** | Descriptive label identifying the external application or system. |
| **API Key Prefix** | Public identifier prefix. |
| **Assigned Role** | Casbin RBAC role governing API endpoint authorizations. |
| **Rate Limit** | Maximum allowed requests per 60-second sliding window. |
| **Target URL** | Destination HTTPS endpoint receiving webhook payloads. |
| **Outbox Status** | Delivery state (`Pending`, `Sent`, `Failed`). |
| **System Version** | Active Git commit hash and release deployment timestamp. |
