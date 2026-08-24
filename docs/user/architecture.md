---
id: architecture
title: "System Architecture"
description: "Technical architecture, key components, data flow, security model, and implementation details of HeroBM."
category: "Overview"
order: 1
routes:
  - "/help"
tags: ["architecture", "engineering", "infrastructure", "nestjs", "nextjs", "postgres", "drizzle", "gl-engine", "inventory-engine", "outbox", "casbin", "security", "bullmq", "redis"]
fields:
  tri_schema:
    title: "Tri-Schema Architecture"
    summary: "Three-tier PostgreSQL schema isolating legacy staging (cleansing), marts (transformation), and herobm_core (operational OLTP)."
  gl_engine:
    title: "Double-Entry GL Engine"
    summary: "ACID-compliant general ledger enforcing strict debit-credit balance invariants on all operational postings."
  inventory_ledger:
    title: "Double-Entry Inventory Ledger"
    summary: "Perpetual stock ledger recording bin-to-bin movements with a product valuation cache for instant Weighted Average Cost (WAC)."
  transactional_outbox:
    title: "Transactional Outbox & Async Relay"
    summary: "Dual-write prevention pattern publishing events atomically with business mutations to PostgreSQL and relaying via BullMQ."
  casbin_rbac:
    title: "Casbin RBAC Authorization"
    summary: "Centralized Data Access Service (DAS) enforcing resource and action permissions with a default-deny policy."
  state_machines:
    title: "Deterministic State Machines"
    summary: "Centrally declared lifecycle transition graphs and UI ordinals across orders, shipments, and financial documents."
  typst_reporting:
    title: "Typst Document Engine"
    summary: "High-performance programmable compiler generating pixel-perfect PDFs for commercial and operational documents."
  tiered_verification:
    title: "Tiered Verification Hierarchy"
    summary: "Automated quality gates spanning sub-second unit tests to full containerized integration and API tests."
related:
  - "overview"
  - "technical-operations"
  - "api-reference"
  - "webhooks-api"
  - "install-guide"
---

# System Architecture

HeroBM is a composable, modular Business Management and ERP platform engineered for reliability, transparency, and operational velocity. It unifies sales order fulfillment, perpetual warehouse inventory, procurement, manufacturing, CRM, and double-entry general ledger accounting into a single real-time transactional system.

This page provides Software Engineers, IT Professionals, and System Administrators with a comprehensive technical blueprint of the platform's architecture, key components, data flow, security model, and implementation patterns.

---

## 1. High-Level System Topology

The architecture follows a modular monolith approach for synchronous operations paired with an asynchronous background worker for event distribution and external integrations.

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        UI["Ops Portal (Next.js 15 / React 19)<br/>AG Grid • Tailwind • next-intl"]
    end

    subgraph Backend ["Application Backend"]
        API["NestJS Core API (:3001)<br/>Passport JWT • Casbin Guard • Drizzle ORM"]
        Worker["Outbox Relay Worker (:9091)<br/>BullMQ • Redis • Pino"]
    end

    subgraph Data ["Data & Storage Layer (PostgreSQL 16)"]
        CoreDB[("herobm_core<br/>(Operational OLTP & Outbox)")]
        StagingDB[("public_staging<br/>(Cleansed Imports)")]
        MartsDB[("public_marts<br/>(dbt Transformations)")]
        RedisDB[("Redis<br/>(Job Queues & Cache)")]
    end

    subgraph External ["External & Integrations"]
        ExtERP["External ERP / BI"]
        Webhooks["Webhook Subscriptions"]
        SMTP["SMTP Email Server"]
        PDF["Typst PDF Compiler"]
    end

    UI -->|REST / JWT / JSON| API
    API -->|Drizzle ORM Queries & Mutations| CoreDB
    API -->|Atomic Event Enqueue| CoreDB
    API -->|Compile Document| PDF
    Worker -->|Poll Outbox Table| CoreDB
    Worker -->|Queue Jobs & Deduplicate| RedisDB
    Worker -->|Async Payloads| ExtERP
    Worker -->|HTTPS Webhook Dispatch| Webhooks
    Worker -->|Send Emails| SMTP
    StagingDB -->|dbt Models| MartsDB
    MartsDB -->|Initial Migration Seeding| CoreDB
```

---

## 2. Monorepo Organization & Key Components

HeroBM is structured as a TypeScript monorepo using npm workspaces and Turborepo:

### Applications (`apps/`)

| Application | Technology Stack | Responsibility |
| :--- | :--- | :--- |
| **`apps/ops-portal`** | Next.js 15 (App Router), React 19, AG Grid Community, TailwindCSS, `next-intl` | High-density administrative and operational web UI. Employs a dense "Machine Shop" interface aesthetic, client-side data fetching (`apiFetch`/`apiMutate`), persisted table state (`localStorage`/`sessionStorage`), and contextual help drawers. |
| **`apps/api`** | NestJS 11, TypeScript, Drizzle ORM, Passport JWT, Casbin RBAC | Core transactional REST API listening on port `3001`. Enforces business logic, authentication, fine-grained authorization, database transactions, and document compilation. |
| **`apps/worker`** | Node.js, BullMQ, Redis, Pino Logger | Standalone background processor listening on port `9091`. Executes transactional outbox polling, external ERP syncing, webhook event dispatching, and asynchronous email delivery. |
| **`apps/mcp-server`** | Model Context Protocol (MCP) SDK | Dedicated MCP server exposing database schemas, API discovery, and documentation to AI agents and development assistants. |

### Shared Packages (`packages/`)

| Package | Responsibility |
| :--- | :--- |
| **`@herobm/db-schema`** | Canonical Drizzle ORM schema definitions (`herobm-core-schema.ts`), PostgreSQL migration files, and database relationship models. |
| **`@herobm/shared`** | Zero-dependency shared domain logic: state machine transition graphs, UI lifecycle ordinals, stock availability formulas (`calculateAvailableQuantity`), tax algorithms, and line price calculations. |
| **`@herobm/sdk`** | Strongly typed API client library, custom fetch wrappers (`customFetch`), and shared response interfaces for portal and external consumers. |

---

## 3. Database Architecture: The Tri-Schema Model

HeroBM uses PostgreSQL 16 with a clean **Tri-Schema** architecture. This separation ensures operational OLTP workflows remain strictly isolated from legacy data extraction and analytical transformations.

```mermaid
flowchart LR
    subgraph S1 ["1. Ingestion Layer"]
        Raw["Raw Data / ODBC"] --> Staging["public_staging"]
    end

    subgraph S2 ["2. Transformation Layer"]
        Staging --> Marts["public_marts"]
    end

    subgraph S3 ["3. Operational Core"]
        Marts -.->|Initial Import Pipeline| Core["herobm_core"]
        API["NestJS API"] <-->|Drizzle ORM (Read/Write)| Core
    end
```

### 1. `public_staging` (Ingestion & Cleansing)
- **Owner:** dbt (`pipelines/abm_transform/models/staging/`)
- **Role:** Cleanses, casts, and normalizes raw legacy database extracts (e.g. ABM, ODBC, CSV).
- **Rule:** Contains no operational business logic; converts legacy names to `snake_case` and strings to strongly typed numeric and date fields.

### 2. `public_marts` (Transformation & Analytics)
- **Owner:** dbt (`pipelines/abm_transform/models/marts/`)
- **Role:** Denormalized, flattened reporting tables and dimensional models.
- **Rule:** The operational API **never** reads from or writes to `public_marts`. It is utilized strictly by data analysis pipelines and the initial migration seeding script.

### 3. `herobm_core` (Transactional Application Core)
- **Owner:** Drizzle ORM (`packages/db-schema` / `apps/api/src/drizzle/`)
- **Role:** The authoritative transactional source of truth for all operational data.
- **Characteristics:**
  - Highly normalized third normal form (3NF) relational design.
  - Every table uses `gen_random_uuid()` UUIDs as primary keys.
  - Enforces strict foreign keys (`ON DELETE RESTRICT`) and `CHECK` constraints (e.g., verifying status enums against state machine definitions).
  - Contains immutable subledger tables and the `outbox` table.
  - The NestJS API exclusively reads and writes to this schema.

---

## 4. Core Subsystem Implementations

### A. Double-Entry General Ledger (GL) Engine

HeroBM contains a native, ACID-compliant double-entry accounting engine (`apps/api/src/gl/`):

```mermaid
flowchart TD
    subgraph Invariant ["Mathematical Balance Invariant"]
        L1["Debit Lines (>= 0)"]
        L2["Credit Lines (>= 0)"]
        L1 --- InvariantCheck{"Sum(Debits) == Sum(Credits)<br/>(Tolerance <= 0.005)"} --- L2
    end
    InvariantCheck -->|Pass| Commit["Commit to herobm_core.gl_journal_entries<br/>+ gl_journal_lines"]
    InvariantCheck -->|Fail| Abort["Abort Transaction (400 Bad Request)"]
```

- **Mathematical Balance Invariant:** Every journal entry must have $\ge 2$ lines and satisfy $\sum \text{Debits} = \sum \text{Credits}$ within a strict $0.005$ tolerance.
- **Leaf-Node Posting Only:** Transactions can only post to leaf accounts (`is_group = false`). Posting to parent summary accounts is blocked.
- **Atomic Subledger Integration:** When subledgers post financial events (such as Sales Invoices, Goods Received, or Payments), they pass their active database transaction (`tx`) to `GlService.postJournalEntry(lines, meta, tx)`. If the GL entry fails, the entire business operation rolls back atomically.
- **Immutable Ledger & Reversals:** Financial postings are immutable. Corrections are performed exclusively by posting linked reversal entries, maintaining complete audit continuity.
- **Fiscal Period Controls:** Postings automatically validate that the transaction date falls within an `Open` fiscal period, preventing retroactive tampering with locked financial periods.

---

### B. Double-Entry Perpetual Inventory Engine

The inventory engine (`apps/api/src/inventory/`) models stock with the physical principle of conservation: stock never spontaneously appears or disappears—it moves between warehouse bins and external entities.

```mermaid
sequenceDiagram
    participant Picker as Warehouse Operator
    participant API as InventoryService
    participant Ledger as herobm_core.inventory_ledger
    participant Outbox as herobm_core.outbox

    Picker->>API: Pick Sales Order Line (Qty: 5)
    Note over API: Atomic DB Transaction
    API->>Ledger: Insert Line (-5 from Shelf Bin A-101)
    API->>Ledger: Insert Line (+5 to Location SHIPPING Bin)
    API->>Outbox: Enqueue INVENTORY_ENTRY_CREATED
    Note over API: Transaction Committed
    API-->>Picker: Pick Confirmed
```

- **Ledger Invariant:** Every movement creates an `inventory_entries` header and matching `inventory_ledger` lines recording changes against exact bin IDs and location numbers.
- **Valuation Cache (`quantityOnHand`):** While real-time stock balances are aggregated from the immutable ledger via database views (`inventory_levels`, `bin_contents`), `products.quantityOnHand` serves as a dedicated valuation cache updated during goods receipt to compute the Weighted Average Cost (WAC):
  $$\text{New WAC} = \frac{(\text{Old Qty} \times \text{Old WAC}) + (\text{Receipt Qty} \times \text{Unit Cost})}{\text{Old Qty} + \text{Receipt Qty}}$$
- **Available Stock Formula:** Stock availability is computed uniformly across frontend and backend using the canonical shared formula:
  $$\text{Available} = \text{On Hand} - \text{Committed} - \text{Reserved}$$

---

### C. Deterministic State Machines

Business documents (Sales Orders, Purchase Orders, Shipments, Returns, and Invoices) progress through formal, deterministic state machines defined centrally in `@herobm/shared/state-machines`:

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> quoted
    quoted --> confirmed
    confirmed --> picking
    picking --> shipped
    shipped --> invoiced
    invoiced --> [*]
    
    draft --> cancelled
    quoted --> cancelled
    confirmed --> cancelled
    cancelled --> draft : Reopen
```

- **Dedicated State Routes:** State changes are executed strictly via `PATCH /api/{resource}/{id}/state` rather than arbitrary column patching.
- **Row Locking & Validation:** The API acquires a database row lock, verifies that the transition is permitted in the transition matrix (`TRANSITION_MAP[currentState]`), and applies the mutation.
- **UI Lifecycle Ordinals:** Transition actions in the Ops Portal are automatically styled using lifecycle ordinals (`LIFECYCLE_ORDINALS`): forward transitions render as primary buttons, backward reversions as warning buttons, and cancellations as danger buttons.

---

### D. Transactional Outbox & Event-Driven Relay

To prevent dual-write anomalies when notifying external systems, Webhooks, or email servers, HeroBM utilizes the **Transactional Outbox Pattern**:

```mermaid
flowchart LR
    API["API Mutation"] -->|Same DB Transaction| DB[("herobm_core.sales_orders<br/>+ herobm_core.outbox")]
    DB -.->|Poll Unprocessed (5s)| Worker["Worker Process (BullMQ)"]
    Worker -->|Job Dispatch| Redis[("Redis Queue")]
    Redis -->|Execute| Handler["Event Handlers"]
    Handler --> Webhook["Webhooks (HTTPS)"]
    Handler --> Email["Email Outbox (SMTP)"]
    Handler --> ERP["External Systems"]
```

1. **Atomic Write:** The NestJS API writes domain records and inserts an outbox event into `herobm_core.outbox` within the **exact same database transaction**.
2. **Asynchronous Polling:** The standalone worker polls for unprocessed outbox records every 5 seconds.
3. **BullMQ & Redis:** Events are enqueued into BullMQ with job-ID deduplication, exponential retry backoff, and IPv4 TCP keep-alives.
4. **Guaranteed Delivery:** Handlers map events to external payloads, dispatch HTTPS webhooks, and process SMTP email queues without blocking user requests.

---

### E. Authorization & Security Architecture (Casbin RBAC)

Authentication and Authorization operate as a centralized Data Access Service (DAS):

```mermaid
flowchart TD
    Req["Incoming HTTP Request"] --> AuthN["JwtAuthGuard<br/>(Validates JWT & Extracts User + Role)"]
    AuthN --> AuthZ["CasbinGuard<br/>(Extracts @CasbinResource & @CasbinAction)"]
    AuthZ --> Policy{"Casbin Enforcer<br/>(model.conf + policy.csv)"}
    Policy -->|Allowed| Controller["Controller Handler"]
    Policy -->|Denied| Deny["403 Forbidden Response"]
```

- **Authentication (AuthN):** Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256, issued via `/api/auth/login`. Passwords and API keys are hashed using `bcrypt`.
- **Authorization (AuthZ):** The `CasbinGuard` inspects route metadata (`@CasbinResource`, `@CasbinAction`) and queries the in-memory Casbin Enforcer against `policy.csv`.
- **Role Hierarchy:** All authenticated users inherit the base `viewer` role (granting system-wide read access for operational transparency). Specific write roles (`sales`, `warehouse`, `procurement`, `finance`, `admin`) are granted explicit mutation permissions.
- **Default Deny:** Endpoints without an explicit Casbin policy rule automatically default to deny.

---

### F. High-Performance Document Compilation (Typst)

HeroBM replaces sluggish headless-browser PDF generators with **Typst**, an ultra-fast native markup-based typesetting engine:
- Programmable document layouts for Invoices, Purchase Orders, Picking Slips, Shipping Labels, and Financial Statements located in `tools/seeds/reports/`.
- Embedded barcode rendering (Code 128) and vector typography.
- Sub-100ms compilation times enabling instant in-app previews and binary streaming (`apiFetchBlob`).

---

## 5. Deployment, Observability & IT Operations

Designed specifically for predictable, low-maintenance deployment in on-premises or cloud environments:

### Container Orchestration
The entire platform is orchestrated via `podman compose` or `docker compose`:

```text
┌────────────────────────────────────────────────────────┐
│                   Host Machine                         │
│                                                        │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────┐   │
│   │  Ops Portal  │   │   Core API   │   │  Worker  │   │
│   │ (Next.js:3000│   │ (NestJS:3001)│   │  (:9091) │   │
│   └──────┬───────┘   └──────┬───────┘   └────┬─────┘   │
│          │                  │                │         │
│          ▼                  ▼                ▼         │
│   ┌────────────────────────────────────────────────┐   │
│   │       PostgreSQL 16 (:5432) & Redis (:6379)    │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Logging & Diagnostics
- **Dual Structured Logging:** Applications emit structured JSON to `stdout` (captured with Docker's `json-file` driver bounded to `20MB` max per file) and persist formatted operational logs to a mounted volume (`/app/logs/api.log`, `worker.log`, `postgres.log`).
- **In-Portal Log Viewer:** System administrators can inspect live server logs securely at **Technical** → **System Logs** (`/admin/system-logs`) without requiring SSH access to the host.

### Database Migrations & The Drizzle Gate
Database schema evolution is strictly automated:
- Schema definitions in TypeScript (`packages/db-schema`) compile to idempotent DDL migrations.
- Direct ad-hoc database mutations are forbidden; all migrations are generated using `make dev-db-generate` and applied via `make migrate`.

### Tiered Quality Verification Hierarchy

Developers and CI/CD pipelines enforce code health through a strict tiered hierarchy:

| Tier | Make Target | Execution Time | Scope |
| :--- | :--- | :--- | :--- |
| **Tier 0** | `make check-types`, `make check-lint`, `make test-single` | $< 5\text{s}$ | Active inner-loop feedback during development. |
| **Tier 1** | `make verify-fast` | $< 25\text{s}$ | Fast pre-commit gate: static types, lints, in-memory PGlite unit tests, and schema drift checks. |
| **Tier 2** | `make verify-api`, `make verify-portal`, `make verify-pipeline` | $30\text{--}60\text{s}$ | Subsystem validation including PostgreSQL integration tests and Next.js production builds. |
| **Tier 3** | `make pre-push`, `make verify-all` | $2\text{--}3\text{m}$ | Full repository verification and container image build validation. |
| **Tier 4** | `make test-heavy` | $5\text{--}10\text{m}$ | Full isolated stack boot with end-to-end browser regression and fuzzing suites. |
