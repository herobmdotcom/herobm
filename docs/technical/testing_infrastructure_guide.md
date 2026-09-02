# Testing Infrastructure & Quality Assurance Guide

HeroBM relies on a multi-tiered, cross-platform testing strategy to enforce architectural boundaries, security policies, data integrity, and end-to-end user workflows. As mandated by `CONSTITUTION.MD`, the system utilizes an "Immune System" approach where architectural rules and conventions are encoded as automated structural tests.

---

## 1. The 5-Tier Verification Hierarchy

HeroBM structures testing into five distinct tiers, balancing feedback speed with integration fidelity:

```
+-------------------------------------------------------------------------+
| Tier 4: Heavy Regression (5-10m) — make test-heavy                      |
| (Podman stack: container fuzzing, email/webhook daemons, full browser)  |
+-------------------------------------------------------------------------+
| Tier 3: Pre-Push & CI Gates (2-3m) — make verify-all / GitHub Actions   |
| (Full monorepo build, verify-fast, test-structural, test-api-e2e)       |
+-------------------------------------------------------------------------+
| Tier 2: Subsystem Verification (30-60s)                                 |
| (make verify-api, make verify-portal, make verify-pipeline)             |
+-------------------------------------------------------------------------+
| Tier 1: Task Gate / Fast Pre-Commit (< 25s) — make verify-fast          |
| (Typecheck, ESLint, OAS lint, PGlite unit tests, schema drift, deps)    |
+-------------------------------------------------------------------------+
| Tier 0: Dev Inner Loop (Sub-second to 5s)                               |
| (make check-types, make check-lint, make test-single TEST=<name>)       |
+-------------------------------------------------------------------------+
```

---

## 2. Test Selection Decision Matrix

| What are you testing? | Recommended Tool / Suite | Command | Execution Speed |
| :--- | :--- | :--- | :--- |
| **Simple helper logic / pure utility** | Jest with pure functions or `createMockDb()` | `make test-single TEST=<name>` | Instant (< 1s) |
| **Transactional DB logic / GL journals / constraints** | PGlite WASM in-memory PostgreSQL engine | `npm run test:unit:pglite -w apps/api` | Fast (< 3s) |
| **API Endpoints, Casbin AuthZ, Multi-step state machines** | Supertest against real PostgreSQL (`apps/api/test/*.e2e-spec.ts`) | `make test-api-e2e` | Medium (15-30s) |
| **UI Components, Hooks, DataGrid renderers** | React Testing Library + Jest (`apps/ops-portal/app/**/__tests__`) | `make test-portal-unit` | Fast (< 10s) |
| **Browser User Journeys, Slide-overs, Page Navigation** | Playwright (`apps/ops-portal/e2e/*.spec.ts`) | `make test-portal-e2e` | Medium (15-45s) |
| **Architectural Boundaries, Anti-patterns, Security invariants** | TypeScript AST structural tests (`infra/tests/test_adv_*.ts`) | `make test-structural` | Fast (5-10s) |
| **Data Extraction, dbt Transformations, Schema counts** | Pipeline runner & Python audit scripts | `make verify-pipeline` | Medium (30-45s) |
| **Full Containerized Fuzzing & Outbox Relays** | Heavy isolated Podman test stack | `make test-heavy` | 5–10m |

---

## 3. Structural & Static Analysis Tests (The Immune System)

Structural tests live in `infra/tests/` and are executed via `make test-structural` (or directly via `npx tsx infra/test-utils/run-structural.ts`). They parse source files via regex and TypeScript ASTs to prevent convention drift and architectural violations.

### Key Structural Invariant Checks:
*   **`test_controller_authz.ts`**: Ensures all NestJS controllers declare `@CasbinResource` and action guards.
*   **`test_no_hardcoded_secrets.ts`**: Scans the monorepo for hardcoded passwords, tokens, or URIs.
*   **`test_drizzle_schema_sync.ts`**: Ensures Drizzle ORM schema definitions remain in sync with database migrations.
*   **`test_no_inline_pricing.ts` / `test_no_inline_inventory_math.ts`**: Enforces that business math is imported from `@herobm/shared`.
*   **`test_api_fetch_usage.ts` / `test_no_raw_fetch.ts`**: Verifies that the frontend strictly uses `apiFetch<T>` utility wrappers instead of raw `fetch()`.
*   **`test_adv_*.ts`**: 120+ regression tests generated from Continuous Improvement Advisories to immunize against past systemic issues.

---

## 4. Backend Testing Tiers (API)

### MockDrizzle Tier (Fast)
Used for unit testing business calculations and simple services without database constraints. Uses virtual memory mocks.

### PGLite Tier (In-Memory WASM PostgreSQL)
Used for services that execute transactional logic, double-entry GL postings, or complex queries:
- **Utility:** `setupPgliteSuite()` in `apps/api/src/test-utils/pglite-suite.ts`.
- **Isolation:** The engine is provisioned per test suite; use `beforeEach` to truncate tables in FK order.
- **Seeds:** Includes `runStandardSeeds()` to populate baseline Chart of Accounts, Tax, and UOM definitions.

### PostgreSQL E2E Tier (Real DB Integration)
Full contract testing of NestJS HTTP controllers and multi-step state machines:
- **Location:** `apps/api/test/*.e2e-spec.ts`
- **Execution:** `make test-api-e2e` (uses `apps/api/test/utils/provision-e2e-db.ts` to clone the template database via copy-on-write).

---

## 5. Frontend & UI Testing (Ops Portal)

### Component & Hook Unit Tests
React Testing Library tests located in `apps/ops-portal/app/**/__tests__/` and `components/**/__tests__/`.
```bash
make test-portal-unit
```

### Playwright Browser E2E Tests
End-to-end browser tests located in `apps/ops-portal/e2e/`. Tests run against an authenticated storage state (`auth.setup.ts`).
```bash
# Run against default local portal (http://localhost:4301 or http://localhost:4300)
make test-portal-e2e

# Run against custom target
make test-portal-e2e PORTAL_URL=http://localhost:3000
```

---

## 6. GitHub Actions Continuous Integration (CI)

Every commit pushed to `main` and all Pull Requests targeting `main` trigger the automated CI workflow defined in `.github/workflows/ci.yml`.

### CI Pipeline Stages:
1. **Dependency Installation:** `npm ci` and native platform binary binding (`scripts/install-native-deps.js`).
2. **Package Compilation:** Compiles `@herobm/shared`, `@herobm/db-schema`, and `@herobm/sdk`.
3. **Tier 1 Fast Gate:** `make verify-fast` (types, ESLint, Spectral OpenAPI linting, PGlite unit tests, schema drift, dependency manifests).
4. **Immune System Gate:** `make test-structural` (evaluates all 126 AST invariant tests).
5. **Portal Production Build:** `make build-portal` (verifies Next.js 15 routing, server/client boundaries, and standalone bundling).
6. **Backend API E2E:** Boots an ephemeral PostgreSQL service container (`postgres:16-alpine`), applies migrations, and executes `make test-api-e2e`.
