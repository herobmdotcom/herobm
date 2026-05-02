# Outbox Relay Guide

The outbox relay (`apps/worker/`) is a standalone Node.js process that bridges ModBM operational events to external systems (such as legacy ERPs or external General Ledgers). It implements the [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html): the API writes events atomically alongside business data, and the worker asynchronously relays them to downstream consumers via BullMQ.

## Architecture

```
ModBM API (NestJS, port 3001)
  │  INSERT into modbm_core.outbox (same DB transaction as business write)
  ▼
Postgres — modbm_core.outbox table
  │  Poll every 5 s (SELECT … WHERE processed_at IS NULL)
  ▼
Outbox Relay Worker (apps/worker/, port 9091)
  │  Enqueue into BullMQ (Redis)
  ▼
BullMQ Worker (concurrency: 5)
  │  Maps event → External System Payload
  ▼
External System (e.g. ERPNext, external BI)
```

## What the outbox relay does

1. **Poll** — Every 5 seconds, queries `modbm_core.outbox` for unprocessed events of handled types. Batch size: 50.
2. **Enqueue** — Adds each event to BullMQ queue `external-sync` with job-ID deduplication. Marks the outbox row as `processed_at = NOW()`.
3. **Process** — BullMQ workers pick up jobs and map each event type to a payload for the external system via the `processEvent` function.
4. **Observe** — Exposes Prometheus counters on `:9091/metrics` and structured JSON logs via pino.

## Outbox table schema

The outbox table lives in the `modbm_core` Postgres schema and is written to by the API in the same transaction as the business data write.

| Column | Type | Description |
|--------|------|-------------|
| `outbox_id` | `uuid` (PK) | Auto-generated event identifier |
| `aggregate_type` | `text` | Entity domain: `sales_order`, `purchase_order` |
| `aggregate_id` | `uuid` | ID of the parent entity (e.g. `sales_order_id`) |
| `event_type` | `text` | One of the 4 handled types (see below) |
| `payload` | `jsonb` | Event-specific data (line items, totals, IDs) |
| `created_on` | `timestamptz` | Row insertion time (auto) |
| `processed_at` | `timestamptz` | Set by the relay when enqueued; `NULL` = pending |

### Outbox write guard

Not every event is outbox-eligible. The `writeEvent()` helpers in the API write **all** event types to entity audit tables (`sales_order_events`, `purchase_order_events`) but only enqueue events with active external system mappers to the outbox:

```typescript
const OUTBOX_EVENT_TYPES = new Set([
  'goods_received',
  'goods_dispatched',
  'sales_invoiced',
  'purchase_invoiced',
]);

// Always: audit table INSERT
// Conditionally: outbox INSERT (only if OUTBOX_EVENT_TYPES.has(eventType))
```

Events like `created`, `status_changed`, `line_added`, `archived`, etc. are written to audit tables only — they never enter the outbox.

## Event types & Mappers

| Event Type | Trigger | Example External System Impact |
|-----------|---------|---------------|
| `goods_received` | Goods receipt recorded | Inventory Asset / GRNI Liability sync |
| `goods_dispatched` | Shipment dispatched | COGS / Inventory Asset sync |
| `sales_invoiced` | Sales invoice created | AR sync (Debtors: Customer) |
| `purchase_invoiced` | Purchase bill created | AP sync (Creditors: Supplier) |

### JIT master data sync

For `sales_invoiced` and `purchase_invoiced`, the worker may perform just-in-time (JIT) master data synchronisation: if the customer/supplier does not yet have an external ID, the worker creates the corresponding entity in the external system and writes the resulting ID back to the ModBM `accounts` or `suppliers` table as `external_id`.

### Purchase price variance

The `goods_received` mapper handles standard cost variance. If `purchasePriceVariance` is non-zero, additional financial sync logic may be posted.

## Module structure

```
apps/worker/
├── src/
│   ├── outbox-relay.ts       # Entry point: DB, Redis, BullMQ, Metrics, polling
│   ├── relay.service.ts      # pollOutbox() + processEvent() logic
│   ├── schema.ts             # Drizzle schema (outbox + accounts/suppliers/invoices)
│   └── logger.ts             # Pino structured logger
├── Dockerfile                # Production image
├── package.json
└── tsconfig.json
```

### API-side components

```
apps/api/src/
├── orders/
│   └── shipment-helpers.ts   # writeEvent() with OUTBOX_EVENT_TYPES guard (SO events)
├── purchase-orders/
│   └── purchase-orders.service.ts  # writeEvent() with OUTBOX_EVENT_TYPES guard (PO events)
├── receptions/
│   └── receptions.service.ts       # Direct outbox INSERT for goods_received
└── invoices/
    ├── invoices.controller.ts      # Invoice CRUD endpoints (trigger outbox writes)
    ├── sales-invoice.service.ts    # Outbox INSERT for sales_invoiced
    ├── purchase-invoice.service.ts # Outbox INSERT for purchase_invoiced
    ├── outbox-sync.controller.ts   # Dashboard API (GET/DELETE events)
    └── invoices.module.ts
```

## Configuration

All configuration is via environment variables (no hardcoded secrets per Constitution §8):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | — | Postgres username |
| `POSTGRES_PASSWORD` | Yes | — | Postgres password |
| `POSTGRES_HOST` | No | `localhost` | Postgres hostname |
| `POSTGRES_PORT` | No | `5432` | Postgres port |
| `POSTGRES_DB` | No | `custom_app` | Postgres database name |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PASSWORD` | Yes | — | Redis password |
| `EXTERNAL_API_URL` | No | — | External system base URL |
| `EXTERNAL_API_KEY` | Yes | — | External API key |
| `EXTERNAL_API_SECRET` | Yes | — | External API secret |

## Observability

### Structured logging

The worker uses [pino](https://getpino.io/) with two named loggers:

- `relay` — Polling lifecycle, enqueue outcomes, errors
- `processing` — Per-event processing, payload creation, JIT sync

Example log output:
```json
{"level":"info","name":"processing","eventId":"abc-123","eventType":"sales_invoiced","msg":"Created External Sync Payload"}
```

### Prometheus metrics

Exposed on `:9091/metrics`, scraped by the platform Prometheus instance.

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `outbox_events_processed_total` | Counter | `event_type` | Events successfully enqueued |
| `outbox_events_failed_total` | Counter | `event_type` | Event processing failures |
| `external_sync_success_total` | Counter | `event_type` | Successful payloads sent |
| `process_*`, `nodejs_*` | Gauge | — | Default Node.js metrics |

## Sync dashboard

The ops portal includes a monitoring dashboard at **Settings → External Sync** (`/settings/external-sync`).

### Dashboard API endpoints

| Method | Path | Action | Description |
|--------|------|--------|-------------|
| `GET` | `/api/settings/external-sync` | `read` | Summary counts + per-type breakdown + recent events |
| `GET` | `/api/settings/external-sync/events?type=X` | `read` | List pending events by type |
| `DELETE` | `/api/settings/external-sync/events?type=X` | `write` | Clear pending events by type |

### Dashboard features

- **Summary cards** — Total pending, processed, and total event counts
- **Event type breakdown** — Per-type table with pending/processed counts, status badges, View and Clear buttons
- **View drawer** — Inline expandable panel showing individual events with payload inspection
- **Clear action** — Deletes pending events of a specific type (with confirmation)
- **Recent events log** — Scrollable table of the most recent 100 events with expandable payloads
- **Auto-refresh** — Optional 5-second polling toggle

## How to run

```bash
# Docker (with external stack if configured)
make up-worker          # Builds worker image and starts the relay

# Local development
cd apps/worker && npx tsx src/outbox-relay.ts   # Needs .env with all vars
```

## How to add a new event type

1. **Define the event type** — Add the new type string to `OUTBOX_EVENT_TYPES` in both:
   - `apps/api/src/orders/shipment-helpers.ts` (for SO-domain events)
   - `apps/api/src/purchase-orders/purchase-orders.service.ts` (for PO-domain events)
   - Or the relevant service's `writeEvent()` function

2. **Emit the event** — In the service that triggers the business action, call `writeEvent()` with the new type and a payload containing all data the mapper will need.

3. **Add a mapper** — In `apps/worker/src/relay.service.ts`, add an `else if (type === 'your_new_type')` branch to `processEvent()` that constructs the external payload and sends it.

4. **Update the constant** — Add the new type to `HANDLED_EVENT_TYPES` in `relay.service.ts`.

5. **Test** — Use the simulation script to generate events:
   ```bash
   npx tsx --env-file=.env scripts/simulate_transactions.ts --mode=batch --count=5
   ```

6. **Monitor** — Check the External Sync dashboard for successful processing.
