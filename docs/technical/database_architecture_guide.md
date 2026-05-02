# Tri-Schema Database Architecture

The Composable ERP utilizes a "Tri-Schema" PostgreSQL database architecture to manage the transition from the legacy ABM system to the modern, API-driven platform. This design cleanly separates legacy data ingestion, transformation, and the operational application core.

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
        Marts -- "Initial Import Pipeline" --> Core[(modbm_core)]
        App(NestJS API) -- "Reads & Writes" --> Core
        Core -- "Outbox Relay" --> ERPNext
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
* **Purpose:** Provides a clean, typed interface over the messy legacy data imported from ABM via ODBC/dlt.
* **Rules:**
  * Translates ABM column names to `snake_case`.
  * Coalesces NULLs and safely casts legacy string-math fields into proper `numeric` types.
  * *No business logic or complex joins occur here.*

### 2. `public_marts` (The Transformation Layer)
* **Owner:** dbt (`pipelines/abm_transform/models/marts/`)
* **Purpose:** Denormalized, flattened tables that apply business logic and join related staging data together.
* **Rules:**
  * **Strict Access Boundary:** The application API **DOES NOT** read from or write to `public_marts`.
  * The only system that reads from `public_marts` is the **Initial Import Pipeline** which seeds the core database during setup/migration.

### 3. `modbm_core` (The Application Source of Truth)
* **Owner:** Drizzle ORM (`apps/api/src/drizzle/modbm-core-schema.ts`)
* **Purpose:** The transactional backbone of the custom application.
* **Characteristics:**
  * Highly normalized.
  * Every table uses `gen_random_uuid()` UUIDs as primary keys.
  * Enforces strict Foreign Key constraints and `CHECK` constraints (e.g., verifying `state_code` enums against the state machines).
  * Contains the `outbox` table utilized by the transactional outbox relay to guarantee ERPNext financial delivery.
* **Rules:**
  * The NestJS API **exclusively READS and WRITES** to this schema.
  * It represents the live state of the business operations.

---

## 2. Managing Schema Synchronization

Because the platform spans legacy extraction tools (dbt) and modern application ORMs (Drizzle), maintaining structural integrity is critical.

* **Import Mapping:** The import scripts read the flattened views from `public_marts` and map them into the heavily constrained relational structure of `modbm_core`.
* **Structural Testing:** The system utilizes the AST test **`test_drizzle_schema_sync.ps1`** to automatically detect and prevent schema definition drift between the application and the database.
