---
id: tech-system-architecture
title: "Platform & Database Architecture"
description: "Foundational architecture: Tri-Schema PostgreSQL design, dbt data pipelines, Drizzle ORM single source of truth, migration ledger, and system seeds."
category: "Architecture & Engineering"
order: 1
resource: "system"
action: "read"
routes:
  - "/admin/settings"
tags: ["architecture", "database", "postgres", "tri-schema", "dbt", "drizzle", "migrations", "seeds"]
---

# Platform & Database Architecture

HeroBM is built on a resilient, typed relational PostgreSQL foundation designed to cleanly isolate raw legacy ingestion, analytical transformations, and the real-time operational transaction engine.

---

## 1. The Tri-Schema Database Architecture

```mermaid
flowchart TD
    subgraph "1. Ingestion Layer (dbt & dlt)"
        Raw[(raw_abm)] -- "dbt staging" --> Staging[(public_staging)]
    end

    subgraph "2. Transformation Layer (dbt)"
        Staging -- "dbt marts" --> Marts[(public_marts)]
    end

    subgraph "3. Operational Core Layer (Drizzle ORM)"
        Marts -- "Initial Import Pipeline" --> Core[(herobm_core)]
        App(NestJS API) -- "Reads & Writes" --> Core
        Core -- "Outbox Relay" --> Webhooks[Webhooks & Event Bus]
        Core -- "Native Double-Entry GL" --> Ledger[Cryptographic General Ledger]
    end
    
    classDef staging fill:#f3e5f5,stroke:#8e24aa
    classDef marts fill:#e8f5e9,stroke:#43a047
    classDef core fill:#e3f2fd,stroke:#1e88e5
    
    Staging class staging
    Marts class marts
    Core class core
```

### Schema Responsibilities

| Schema | Owner / Tool | Purpose | Strict Access Boundary |
| :--- | :--- | :--- | :--- |
| **`raw_abm`** | `dlt` / ODBC extractors | Landing zone for raw legacy ERP data. | Raw mirror of external sources. No manual mutations. |
| **`public_staging`** | `dbt` (`pipelines/abm_transform/models/staging/`) | Cleanses column names to `snake_case`, coalesces NULLs, and safely casts numeric fields. | Views by default; operational tables materialized as tables. No business joins. |
| **`public_marts`** | `dbt` (`pipelines/abm_transform/models/marts/`) | Denormalized dimension and fact models for analytical querying and data migration seeding. | **Strict Boundary**: Operational API never queries or mutates `public_marts`. |
| **`herobm_core`** | Drizzle ORM (`packages/db-schema/src/`) | The single source of truth for the live application. | **Exclusive live access**: All API reads, writes, transactions, GL journals, and outbox queues operate exclusively here. |

---

## 2. Drizzle ORM & Schema Single Source of Truth

The live application schema is defined strictly in TypeScript under `packages/db-schema/src/*.schema.ts`.

### Key Architectural Invariants
1. **UUID Primary Keys**: Every table uses a `uuid` primary key with `gen_random_uuid()` to prevent ID enumeration and enable distributed replication.
2. **Referential Integrity**: All relationships enforce Foreign Key constraints. Master entities use `RESTRICT` delete policies; dependent lines use cascade.
3. **Double-Entry Financial & Stock Ledgers**: Financial entries and stock movements are written to append-only ledgers. `DELETE` operations on financial tables are strictly blocked at the database trigger level (`prevent_financial_deletion`).

---

## 3. Database Migrations & Ledger Linearity

Database migrations are tracked via a strict, sequential ledger managed by `drizzle-kit`:

- **Generating Migrations**: Always execute `make dev-db-generate NAME=<descriptive_name>`. This script guarantees pre- and post-generation linearity checks and updates `apps/api/migrations/meta/_journal.json`.
- **Applying Migrations**: Run `make migrate` to apply pending migrations idempotently (`IF NOT EXISTS`).
- **Conflict Resolution**: Never manually rename migration files or edit `_journal.json`. Delete conflicting local migrations and regenerate against the canonical schema.

---

## 4. System Initialization & Seeds

System initialization is split between core operational values and legacy migration anchors:

- **Core System Seeds (`make seed`)**: Managed by `apps/api/src/seeds/run.ts`. Inserts default admin credentials, system organization singletons, default currency definitions, document sequence counters, and baseline Chart of Accounts (COA) templates.
- **Legacy Import Anchors**: Fixed, deterministic fallback UUIDs (e.g. `00000000-0000-0000-0000-000000000001`) used by dbt pipelines to reconcile unmapped legacy data while preserving foreign key integrity.
