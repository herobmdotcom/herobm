# API Layer Guide

The NestJS API layer (`apps/api/`) provides a typed, authenticated HTTP interface over the dbt marts. All data endpoints require JWT authentication and Casbin RBAC authorisation. The API reads from the `public_marts` schema via Drizzle ORM and never writes to the database (Phase 2 is read-only).

## Architecture

```
public_marts schema (Postgres)
  │  Drizzle ORM (typed select)
  ▼
NestJS API (apps/api/, port 3001)
  │  JWT + Casbin guard on every endpoint
  ▼
HTTP JSON responses → Frontend / CLI
```

The API connects to Postgres using individual connection parameters (`host`, `user`, `password`, `database`) rather than a URI string, to avoid encoding issues with special characters in passwords.

## What the API layer does

1. **Authenticate** — Issues JWTs via `POST /api/auth/login`. Every data endpoint validates the token and extracts the user's role.
2. **Authorise** — The Casbin guard evaluates the user's role against a policy file (`policy.csv`) using the RBAC model (`model.conf`). Controllers declare their resource and action via `@CasbinResource` / `@CasbinAction` decorators.
3. **Query** — Services use Drizzle ORM to run typed `SELECT` queries against the marts tables. All list endpoints support pagination (`page`, `limit`) and search (`search`).
4. **Observe** — A global `MetricsInterceptor` logs every request (method, URL, status code, duration) and records Prometheus metrics.

## Endpoint inventory

| Method | Path | Guard | Mart table | Features |
|--------|------|-------|------------|----------|
| `POST` | `/api/auth/login` | None | — | JWT issuance |
| `GET` | `/api/accounts` | JWT + Casbin | `mart_accounts` | Pagination, search (name, account number, email) |
| `GET` | `/api/accounts/:id` | JWT + Casbin | `mart_accounts` | Single record by `account_id` |
| `GET` | `/api/products` | JWT + Casbin | `mart_products` | Pagination, search (name, product number, barcode) |
| `GET` | `/api/products/:id` | JWT + Casbin | `mart_products` | Single record by `product_id` |
| `GET` | `/api/inventory` | JWT + Casbin | `mart_inventory` | Pagination, search (product, location), filter by `locationNo` |
| `GET` | `/api/inventory/bins` | JWT + Casbin | `mart_bin_contents` | Pagination, search (product, bin number), filter by `locationNo` |
| `GET` | `/api/orders` | JWT + Casbin | `mart_sales_order_lines` | Pagination, search (order number, customer, product) |
| `GET` | `/api/orders/:id` | JWT + Casbin | `mart_sales_order_lines` | Single record by `sales_order_line_id` |
| `GET` | `/api/dashboard/summary` | JWT + Casbin | All marts | Aggregate entity counts |
| `GET` | `/metrics` | None | — | Prometheus metrics |

## Module structure

```
apps/api/src/
├── main.ts                        # Bootstrap, Prometheus /metrics endpoint
├── app.module.ts                  # Root module, global MetricsInterceptor
├── drizzle/
│   ├── schema.ts                  # Typed schema for 5 mart tables
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
- **Pricing & Tax**: Lines calculate their own total derived from `computeLinePriceForStorage` (`@modbm/shared`).
- **Duplicate Line Prevention**: The `OrdersWriteService` throws a `BadRequestException` if multiple lines reference the same `productId`. 
  - **Exception (`SYSTEM-CUSTOM-LINE`)**: The UUID `00000000-0000-0000-0000-000000000000` is explicitly exempted from duplicate product checks. This allows the frontend to submit multiple "Custom Lines" on a single order while maintaining valid foreign key constraints to the `modbm_core.products` table.

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
make test-infra                  # Smoke tests (needs full Docker stack)
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
