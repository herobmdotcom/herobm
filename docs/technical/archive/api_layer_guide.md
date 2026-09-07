---
id: tech-api-layer
title: "NestJS API Layer Architecture"
description: "NestJS backend patterns, controller conventions, DTO validation pipes, Drizzle ORM transactions, and global filters."
category: "Architecture & Engineering"
order: 16
resource: "system"
action: "read"
tags: ["api", "nestjs", "backend", "drizzle", "controllers", "dtos", "architecture"]
related:
  - "tech-authorization-guide"
  - "dev-authentication"
---

# API Layer Guide

The NestJS API layer (`apps/api/`) provides a typed, authenticated HTTP interface for the ops-portal. All data endpoints require JWT authentication and Casbin RBAC authorisation. The API reads and writes exclusively to the `herobm_core` schema via Drizzle ORM.

## Architecture

```
herobm_core schema (Postgres)
  │  Drizzle ORM (typed select, insert, update)
  ▼
NestJS API (apps/api/, port 3001)
  │  JWT + Casbin guard on every endpoint
  ▼
HTTP JSON responses → Frontend / CLI
```

The API connects to Postgres using individual connection parameters (`host`, `user`, `password`, `database`) rather than a URI string, to avoid encoding issues with special characters in passwords.

## What the API layer does

1. **Authenticate** — Issues JWTs via `POST /api/auth/login` and validates API Keys via `x-api-key`. Every endpoint extracts the user's role and identity.
2. **Authorise** — The Casbin guard evaluates the user's role against live policies stored in PostgreSQL (`casbin_rules`) using a 4-tuple Deny-Override model (`model.conf`). Controllers declare their resource and action via `@CasbinResource` / `@CasbinAction` decorators.
3. **Query & Mutate** — Services use Drizzle ORM to run typed queries against the `herobm_core` schema via `@herobm/db-schema`. All list endpoints support pagination (`page`, `limit`) and search (`search`).
4. **Observe** — A global `MetricsInterceptor` logs every request (method, URL, status code, duration) and records Prometheus metrics.

## Endpoint Inventory & Surface Area

The API surface area follows a rigorous RESTful design pattern, aligning with the directives in `CONSTITUTION.md`. Below is a comprehensive map of the frontend-to-backend API endpoints, grouped by domain. Note that **all endpoints** (except `/api/auth/login` and `/metrics`) strictly require a valid JWT and evaluate Casbin RBAC rules.

### 1. Sales & Fulfillment
Handles the lifecycle of sales orders, picking, shipments, and customer returns.

* **Sales Orders:**
  * `GET /api/sales-orders`
  * `GET /api/sales-orders/{id}`
  * `PATCH /api/sales-orders/{id}/state` (State machine transitions)
  * `POST /api/sales-orders/{id}/archive` / `unarchive` (Soft deletes)
  * `POST /api/sales-orders/{id}/invoice`
* **Sales Order Lines:**
  * `PATCH /api/sales-orders/{id}/lines/{id}`
  * `GET /api/sales-orders/{id}/post-confirmation-lines`
* **Picking:**
  * `GET /api/sales-orders/{id}/picking`
  * `PATCH /api/sales-orders/{id}/picking/lines/{id}`
  * `PATCH /api/sales-orders/{id}/picking/lines/{id}/location`
  * `POST /api/sales-orders/{id}/picking/lines/{id}/pick-all`
  * `POST /api/sales-orders/{id}/picking/pick-all`
* **Shipments:**
  * `GET /api/sales-orders/{id}/shipments`
  * `GET /api/sales-orders/{id}/shipments/{id}`
  * `PATCH /api/sales-orders/{id}/shipments/{id}/state`
* **Returns:**
  * `GET /api/sales-orders/{id}/returns`
  * `PATCH /api/sales-orders/{id}/returns/{id}/state`
  * `PATCH /api/sales-orders/{id}/returns/{id}/lines/{id}`

### 2. Purchasing & Procurement
Handles the inbound lifecycle from supplier purchase orders to invoicing.

* **Purchase Orders:**
  * `GET /api/purchase-orders`
  * `GET /api/purchase-orders/{id}`
  * `PATCH /api/purchase-orders/{id}/state`
  * `GET /api/purchase-orders/{id}/lines`
  * `GET /api/purchase-orders/pending-lines?vendorId={id}`
  * `GET /api/purchase-orders/returnable-lines?productId={id}`
* **Receptions (Goods Received):**
  * `GET /api/purchase-orders/{id}/receptions?limit=50`
  * `GET /api/purchase-orders/{id}/receptions/{id}`
  * `GET /api/goods-received`
  * `GET /api/goods-received/lines?purchaseOrderId={id}`
  * `POST /api/goods-received/lines/{id}/resolve` / `unresolve`
* **Invoices & Matching:**
  * `GET /api/purchase-invoices`
  * `GET /api/purchase-invoices/{id}`
  * `PATCH /api/purchase-invoices/{id}/state`
  * `GET /api/purchase-invoices/{id}/lines`
  * `POST /api/purchase-invoices/lines/{id}/resolve` / `unresolve`
  * `POST /api/purchase-invoices/{id}/auto-match`
  * `GET /api/purchase-orders/{id}/invoices`

### 3. Inventory & Products
Manages catalog data, warehouse topology, and stock levels.

* **Products:**
  * `GET /api/products` (supports `?q={id}&limit=10`)
  * `GET /api/products/{id}`
  * `POST /api/products/{id}/archive` / `unarchive`
  * `GET|POST /api/products/{id}/suppliers`
  * `GET|POST /api/products/{id}/uoms`
  * `GET|POST /api/products/{id}/default-bins`
* **Inventory & Topology:**
  * `GET /api/inventory/by-products?productIds={ids}`
  * `GET /api/inventory/locations`
  * `GET /api/inventory/locations/{id}`
  * `GET /api/inventory/zones/{id}`
  * `GET /api/inventory/bins/{id}`
  * `GET /api/inventory/entries/{id}`
* **Classifications:**
  * `GET /api/product-groups`

### 4. General Ledger & Financials
Chart of accounts, journals, and financial settings.

* **Ledger / Journals:**
  * `GET /api/gl/general-ledger`
  * `GET /api/gl/journal-entries`
  * `GET /api/gl/journal-entries/{id}`
  * `GET /api/gl/trial-balance`
* **Accounts & Configuration:**
  * `GET /api/gl/accounts` (supports `?format=flat`)
  * `GET /api/gl/settings`
  * `POST /api/gl/settings/reload`
  * `GET /api/tax-categories`

### 5. CRM (Accounts & Suppliers)
* **Customer Accounts:**
  * `GET /api/accounts`
  * `GET /api/accounts/{id}`
  * `POST /api/accounts/{id}/archive` / `unarchive`
  * `GET /api/account-groups`
* **Suppliers:**
  * `GET /api/suppliers`
  * `GET /api/suppliers/{id}`
  * `POST /api/suppliers/{id}/archive` / `unarchive`
  * `GET|POST|PATCH|DELETE /api/suppliers/{id}/expiries`
  * `GET /api/supplier-groups`

### 6. System, Settings, & Observability
* **Global Configuration:**
  * `GET /api/settings/organization`
  * `GET /api/settings/exchange-rates`
  * `GET /api/settings/trading-terms`
  * `GET /api/settings/uom-dictionary`
  * `GET /api/macros`
* **Reports & Hooks (Typst Generation):**
  * `GET /api/reports`
  * `GET /api/reports/hooks`
  * `GET /api/reports/hook-assignments`
  * `POST /api/reports/preview`
  * `POST /api/reports/hooks/{hookName}/run?id={id}&context={context}` (Binary Blobs)
* **Observability & Integrations:**
  * `GET /api/dashboard/search?q={id}`
  * `GET /api/dashboard/timeline?{id}`
  * `GET /api/admin/system-logs?service={id}&lines={id}`
  * `GET /api/settings/erpnext-sync`
  * `GET /api/settings/erpnext-sync/events?type={id}&status={status}`

### 7. Setup & Seeding Pipelines
* `GET /api/setup/status`
* `GET /api/setup/progress/{id}`
* `POST /api/setup/initialize`
* `POST /api/setup/test-abm`
* `POST /api/setup/resume-state`

## API Consistency Patterns

### Strengths & Established Paradigms
1. **Strict Pluralization & Resource Orientation:** Almost exclusively, all root-level endpoints use pluralized resource names (`/api/sales-orders`, `/api/products`). This provides high predictability for frontend integrations.
2. **Standardized Sub-Resource Nesting:** Child entities are perfectly nested under their parent aggregate roots (e.g. `/api/sales-orders/{id}/lines/{lineId}`).
3. **State Machine Mutations (`/{id}/state`):** Instead of sending arbitrary `PATCH` bodies to change statuses, the API strictly enforces a state-machine pattern by utilizing dedicated `/state` endpoints. This guarantees business logic transitions occur safely.
4. **Soft Deletion Paradigm:** The API uses explicit RPC-style action routes: `POST /{resource}/{id}/archive` and `POST /{resource}/{id}/unarchive` instead of `DELETE` to prevent orphaned historical ledger records.
5. **Pagination & Query Contracts:** Endpoints consistently utilize `?limit=10` and `?q={searchTerm}` schemas, indicating a shared Pagination/Search DTO across controllers.

### Anomalies & RPC Hybrids
While predominantly RESTful, certain domains shift into RPC-style routes to handle complex operational commands:
1. **Bulk Operations:** Endpoints like `POST /api/sales-orders/{id}/picking/pick-all` effectively capture large transaction boundaries without forcing the frontend to construct massive payloads.
2. **Line Resolution Links:** The cross-system nature of the platform shows up in "linking" endpoints like `POST /api/purchase-invoices/lines/{id}/resolve`.
3. **Report Generation:** Report hooks utilize query parameters to dictate generation behavior: `POST /api/reports/hooks/{hook}/run?id={id}&context=...` to seamlessly output binary blob PDFs.

## Module structure

```
apps/api/src/
├── main.ts                        # Bootstrap, Prometheus /metrics endpoint
├── app.module.ts                  # Root module, global MetricsInterceptor
├── drizzle/
│   ├── herobm-core-schema.ts       # Typed schema for the core application database
│   └── drizzle.module.ts          # Global DI provider (DRIZZLE token)
├── auth/
│   ├── auth.module.ts             # JWT + Passport + Casbin wiring
│   ├── auth.controller.ts         # POST /api/auth/login
│   ├── auth.service.ts            # Credential validation, JWT signing
│   ├── jwt.strategy.ts            # Passport JWT extraction
│   ├── casbin.guard.ts            # RBAC guard + @CasbinResource/@CasbinAction
│   └── casbin/
│       ├── model.conf             # RBAC model (subject, object, action)
│       └── policy.csv             # Role → resource → action mappings
├── accounts/
│   ├── accounts.module.ts
│   ├── accounts.controller.ts     # GET /api/accounts[/:id]
│   └── accounts.service.ts        # Drizzle queries, pagination, search
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts     # GET /api/products[/:id]
│   └── products.service.ts        # Drizzle queries, pagination, search
├── inventory/
│   ├── inventory.module.ts
│   ├── inventory.controller.ts    # GET /api/inventory + /api/inventory/bins
│   └── inventory.service.ts       # Stock levels + bin contents, location filtering
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts       # GET /api/orders[/:id]
│   └── orders.service.ts          # Order line queries, search
├── dashboard/
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts    # GET /api/dashboard/summary
│   └── dashboard.service.ts       # Cross-mart aggregation
└── common/
    └── metrics.interceptor.ts     # Prometheus histogram + counter + logging
```

## Drizzle schema

The file `src/drizzle/schema.ts` maps all 5 marts tables using CDM/Schema.org column names that match the dbt mart output exactly. The schema is read-only — no `insert()`, `update()`, or `delete()` operations are used.

| Drizzle export | Mart table | PK column |
|---------------|------------|-----------|
| `accounts` | `mart_accounts` | `account_id` |
| `products` | `mart_products` | `product_id` |
| `inventory` | `mart_inventory` | `inventory_level_id` |
| `binContents` | `mart_bin_contents` | `bin_contents_id` |
| `salesOrderLines` | `mart_sales_order_lines` | `sales_order_line_id` |

The schema is declared under a custom Postgres schema via `pgSchema('public_marts')`.

## Authentication & authorisation

### AuthN: JWT

- Login via `POST /api/auth/login` with `{ username, password }`
- Passwords are bcrypt-hashed
- Token expires after 8 hours
- JWT payload: `{ sub, username, role }`
- Secret configured via `JWT_SECRET` env var

### AuthZ: Casbin RBAC

The Casbin model uses `(subject, object, action)` tuples with role inheritance:

**Phase 2 roles:**

| Role | Permissions |
|------|------------|
| `viewer` | `read` on all data resources (accounts, products, inventory, orders, dashboard) |
| `admin` | Everything `viewer` can do, plus `read`/`write` on `users` |

Controllers declare their resource and action:
```typescript
@Controller('accounts')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('accounts')
export class AccountsController {
  @Get()
  @CasbinAction('read')
  findAll() { ... }
}
```

## Data Validation & Integrity

The API enforces strict data hygiene rules during mutations (e.g. Sales Orders, Purchase Orders, Returns):
- **Pricing & Tax**: Lines calculate their own total derived from `computeLinePriceForStorage` (`@herobm/shared`).
- **Duplicate Line Prevention**: The `OrdersWriteService` throws a `BadRequestException` if multiple lines reference the same `productId`. 
  - **Exception (`SYSTEM-CUSTOM-LINE`)**: The UUID `00000000-0000-0000-0000-000000000000` is explicitly exempted from duplicate product checks. This allows the frontend to submit multiple "Custom Lines" on a single order while maintaining valid foreign key constraints to the `herobm_core.products` table.

## Observability

### Structured logging

The `MetricsInterceptor` logs every request:
```
[HTTP] GET /api/accounts?limit=10 200 14ms
[HTTP] GET /api/accounts/NONEXISTENT 404 3ms
[HTTP] POST /api/auth/login 201 42ms
```

### Prometheus metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Response latency (p50/p95/p99) |
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total request count |
| `process_*`, `nodejs_*` | Gauge | — | Default Node.js metrics (CPU, memory, event loop) |

Prometheus scrapes the API at `custom-api:3001/metrics` (configured in `configs/prometheus/prometheus.yml`).

### Grafana dashboard

`configs/grafana/provisioning/dashboards/json/custom_api_health.json` — 6 panels:

| Panel | Query |
|-------|-------|
| Request Rate | `rate(http_requests_total[5m])` |
| Response Latency | `histogram_quantile(0.50/0.95/0.99, ...)` |
| Error Rate | `http_requests_total{status_code=~"4../5.."}` |
| Process Memory | `process_resident_memory_bytes` + `nodejs_heap_size_used_bytes` |
| Event Loop Lag | `nodejs_eventloop_lag_seconds` |
| Active Handles | `nodejs_active_handles_total` |

## Testing

### Unit tests (26 tests)

| Suite | Tests | What's mocked |
|-------|-------|---------------|
| `accounts.service.spec.ts` | 5 | Drizzle DB (pagination, search, findOne, not-found, limit cap) |
| `products.service.spec.ts` | 5 | Drizzle DB (same pattern) |
| `auth.service.spec.ts` | 4 | JwtService (login success x2, wrong password, unknown user) |
| `inventory.service.spec.ts` | 5 | Drizzle DB (stock levels, bins, search, limit cap) |
| `orders.service.spec.ts` | 5 | Drizzle DB (pagination, search, findOne, not-found, limit cap) |
| `dashboard.service.spec.ts` | 1 | Drizzle DB (aggregate counts) |

### E2E integration tests (26 tests)

Run against the real Postgres database, proving data flows from dbt marts through Drizzle through the API to HTTP JSON:

| Suite | Tests | What's verified |
|-------|-------|------------------|
| Authentication | 4 | JWT issuance, invalid creds → 401, no token → 401 |
| Accounts pipeline | 5 | Real data from `mart_accounts`, pagination, search, get-by-ID, 404 |
| Products pipeline | 4 | Real data from `mart_products`, search, get-by-ID, 404 |
| Inventory pipeline | 3 | Real data from `mart_inventory`, search, 401 |
| Bin contents pipeline | 2 | Real data from `mart_bin_contents`, search |
| Orders pipeline | 5 | Real data from `mart_sales_order_lines`, search, get-by-ID, 404, 401 |
| Dashboard | 2 | Cross-mart counts, 401 |
| Observability | 1 | MetricsInterceptor doesn't break requests |

### Infrastructure smoke tests

`test_stack_health.ps1` checks:
- `custom-api` container is running and healthy
- Prometheus `custom-api` scrape job is UP

### Running tests

```bash
cd apps/api && npm test          # Unit tests
cd apps/api && npm run test:e2e  # E2E (needs Postgres running with populated marts)
make test-structural             # Infrastructure Structural tests
```

## How to run

```bash
make dev-api    # Local dev: node --env-file=../../.env dist/main.js
make up         # Docker: custom-api starts automatically with the stack
```

## How to add a new endpoint

1. Create a module directory under `src/` (e.g. `src/inventory/`)
2. Add a service that injects `DRIZZLE` and queries the relevant mart table:
   ```typescript
   @Injectable()
   export class InventoryService {
     constructor(@Inject(DRIZZLE) private db: any) {}
     private get database(): DrizzleDB { return this.db as DrizzleDB; }

     async findAll(query?: { search?: string; page?: number; limit?: number }) {
       // pagination + search pattern (see accounts.service.ts)
     }
   }
   ```
3. Add a controller with JWT + Casbin guards:
   ```typescript
   @Controller('inventory')
   @UseGuards(AuthGuard('jwt'), CasbinGuard)
   @CasbinResource('inventory')
   export class InventoryController { ... }
   ```
4. Add the Casbin policy line to `casbin/policy.csv`:
   ```
   p, viewer, inventory, read
   ```
5. Register the module in `app.module.ts`
6. Add unit tests (mock Drizzle) and E2E tests (real Postgres)
7. Run `npm run build && npm test && npm run test:e2e`
