# Migration & Phasing Strategy (Strangler Fig)
A "Big Bang" release replacing a core ERP is extremely risky. We will use a phased rollout:

## Phase 1: Data Extraction & Foundation
- Establish a robust ELT (Extract, Load, Transform) pipeline from ABM's MS SQL Server to the new Postgres DB using Python (`dlt`) and pure SQL (`dbt`).
- Extract and map all core master data (Customers, Products, Pricing Matrices, Suppliers).
- Establish a continuous sync or nightly batch process so the Postgres DB mirrors the live ABM data.

## Phase 2: Workflow & UI Development (Read-Heavy)
- With live ABM data syncing into the new Postgres database, begin building the Custom App frontends (Next.js).
- Deploy early "read-only" operational workflows (e.g., Sales Reps viewing customer history, warehouse staff looking up stock bins) to gain user buy-in without risking data integrity.

## Phase 3: Transaction Cutover (Write-Heavy)
- Begin routing active operational writes (Order Creation, Picking workflows, Stock Adjustments) directly into the new Custom App.
- Transition these specific workflows entirely away from ABM functionality.

## Phase 4: Financial Adoption (ERPNext)
- Deploy ERPNext and establish the General Ledger.
- Implement the Event Queue (Redis/BullMQ) to push financial journals from the completed operations in the Custom App into ERPNext.
- Final cutover: Migrate opening balances from ABM, run a parallel month for validation, and lock ABM.