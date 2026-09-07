---
id: tech-database-architecture
title: "Tri-Schema Database Architecture"
description: "Architecture guide for the tri-schema PostgreSQL design separating ingestion (raw), transformation (marts), and transactional core (herobm_core)."
category: "Architecture & Engineering"
order: 1
resource: "system"
action: "read"
routes:
  - "/admin/settings"
tags: ["database", "postgres", "tri-schema", "dbt", "drizzle", "herobm_core", "architecture"]
---

# Tri-Schema Database Architecture

HeroBM utilizes a "Tri-Schema" PostgreSQL database architecture to manage the transition from legacy systems to the modern, API-driven platform. This design cleanly separates legacy data ingestion, transformation, and the operational application core.

---

## 1. The Three Schemas

```mermaid
flowchart TD
    subgraph "1. Ingestion Layer (dbt)"
        Raw[(raw_abm)] -- "dbt staging" --> Staging[(public_staging)]
    end

    subgraph "2. Transformation Layer (dbt)"
        Staging -- "dbt marts" --> Marts[(public_marts)]
    end

    subgraph "3. Operational Layer (Drizzle ORM)"
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

### 1. `public_staging` (The Cleansing Layer)
* **Owner:** dbt (`pipelines/abm_transform/models/staging/`)
* **Purpose:** Provides a clean, typed interface over legacy data imported via ODBC/dlt.
* **Rules:**
  * Translates legacy column names to standard `snake_case`.
  * Coalesces NULLs and safely casts string-math fields into proper `numeric` types.
  * *No business logic or complex joins occur here.*

### 2. `public_marts` (The Transformation Layer)
* **Owner:** dbt (`pipelines/abm_transform/models/marts/`)
* **Purpose:** Denormalized, flattened tables that apply business logic and join related staging data together.
* **Rules:**
  * **Strict Access Boundary:** The application API **DOES NOT** execute operational transactions against `public_marts`.
  * Used by the initial migration and data import pipelines to seed historical records.

### 3. `herobm_core` (The Application Source of Truth)
* **Owner:** Drizzle ORM (`packages/db-schema/src/*.schema.ts`)
* **Purpose:** The transactional backbone of the live HeroBM application.
* **Characteristics:**
  * Highly normalized relational model.
  * Every entity uses `gen_random_uuid()` UUIDs as primary keys.
  * Enforces strict Foreign Key constraints, enum checks, and database-level immutability triggers (`herobm_core.prevent_financial_deletion`).
  * Contains the `outbox` table utilized by the transactional outbox relay for guaranteed domain event and webhook delivery.
  * Houses the native Double-Entry General Ledger and SHA-256 cryptographic hash chaining engine.
* **Rules:**
  * The NestJS API **exclusively READS and WRITES** to this schema.
  * It represents the live state of all business and financial operations.

---

## 2. Managing Schema Synchronization & Invariants

* **Modular Schema Definition**: Database tables and relations are maintained as modular TypeScript schemas under `packages/db-schema/src/`.
* **Automated Structural Testing**: Schema integrity, foreign key references, and DTO alignments are continuously verified by `make test-structural` (`infra/test-utils/run-structural.ts`).
