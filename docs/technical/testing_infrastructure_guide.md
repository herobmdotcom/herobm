# Testing Infrastructure & Quality Assurance Guide

The Composable ERP relies on a rigorous automated testing strategy to enforce architectural boundaries, security policies, and data integrity. As mandated by `CONSTITUTION.MD`, the system utilizes an "Immune System" approach where architectural rules are encoded as automated structural tests.

All infrastructure and structural tests live in the `/infra/tests/` directory.

---

## 1. Structural & Static Analysis Tests (AST)

These tests do not require a running database or container stack. They parse the source code (using regex and AST-like pattern matching) to ensure developers and AI agents haven't violated core architectural boundaries.

### Key Structural Tests:
*   **`test_controller_authz.ps1`**: Enforces that every NestJS controller uses the `@CasbinResource` decorator, preventing accidental unauthenticated endpoints.
*   **`test_no_hardcoded_secrets.ps1`**: Scans the codebase for hardcoded credentials, JWT secrets, or DB URIs.
*   **`test_drizzle_schema_sync.ps1`**: Ensures that Drizzle ORM schema definitions remain in sync and don't introduce prohibited mutations (like dropping the Outbox table).
*   **`test_no_inline_pricing.ps1` / `test_no_inline_inventory_math.ps1`**: Enforces that complex business math is strictly imported from the `@modbm/shared` package rather than being hardcoded inline.
*   **`test_api_fetch_usage.ps1`**: Verifies that the frontend strictly uses the `apiFetch<T>` utility wrapper instead of raw `fetch()`, ensuring consistent auth-header injection and error handling.

**How to run:**
```bash
make test-structural
```

---

## 2. Infrastructure Smoke Tests

These tests verify that the Dockerized stack is running correctly, ports are bound securely, and internal communication channels are open.

### Key Smoke Tests:
*   **`test_stack_health.ps1`**: Validates that all critical containers (`custom-api`, `ops-portal`, `redis`, `worker`) are `Up` and `healthy`.
*   **`test_port_binding.ps1`**: Ensures that backend services (like Redis and Postgres) are only bound to `127.0.0.1` and not exposed to `0.0.0.0` (public internet).
*   **`test_prometheus_targets.py`**: Queries the local Prometheus instance to ensure all expected targets (Node APIs, BullMQ) are successfully being scraped.

**How to run:**
*(Requires the stack to be running via `make up`)*
```bash
make test-infra
```

---

## 3. Data Parity & Pipeline Tests

Data integrity is the highest priority when migrating from ABM. We must guarantee that the raw data in the staging layer matches the transformed data in the core schema.

*   **`test_data_counts.py`**: A critical Python script that queries the database directly. It compares row counts between `public_staging.stg_*` tables and `modbm_core.*` tables. 
    *   *Nuance:* It understands business logic differences, such as translating flat ABM order lines into nested headers + lines in the core schema.

---

## 4. The Continuous Integration (CI) Workflow

The automated tests are heavily integrated into the project's workflow:
1.  **Local Development:** Developers are expected to run `make test-structural` before committing code.
2.  **The "Inspector" Persona:** When an AI agent acts as the Inspector, it is mandated by the Constitution to run these tests and evaluate the output.
3.  **Advisory Remediation:** When a new vulnerability or architectural drift is discovered, the fix must include a new `test_*.ps1` script in `/infra/tests/` to prevent regressions.

### Adding a New Test
If you identify a new architectural rule that needs enforcement:
1. Create a `.ps1` or `.py` script in `/infra/tests/`.
2. The script must return an exit code `0` on success, and `1` on failure (printing the offending files/lines).
3. Add the script to the relevant Makefile target (`test-structural` or `test-infra`).
