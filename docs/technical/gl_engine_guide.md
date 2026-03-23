# General Ledger Engine Guide

The NestJS General Ledger (GL) module (`apps/api/src/gl/`) provides a robust, double-entry accounting engine built directly into ModBM. It replaces the need for an external financial backend (like ERPNext) for core operational accounting.

## Architecture

```
modbm_core schema (Postgres)
  │  Drizzle ORM (typed schema & mutations)
  ▼
NestJS API (apps/api/, port 3001)
  │  GlModule (Service, Controller, CoaLoader)
  ▼
Other Modules (Invoices) / HTTP JSON / Portal UI
```

The GL engine operates entirely within the native `modbm_core` schema, ensuring ACID compliance and referential integrity with other operational tables (like users and invoices).

## Core Responsibilities

1. **Chart of Accounts (COA) Management** — CRUD operations for accounts arranged in a tree hierarchy across 5 standard root types.
2. **Double-Entry Journal Posting** — Ensures every transaction strictly adheres to the fundamental accounting equation (Debits = Credits).
3. **Financial Reporting** — Aggregations for Trial Balance and General Ledger views.
4. **Idempotent Seeding** — Automatic ingestion of ERPNext-compatible COA JSON files during application initialization.

## Drizzle Schema

The engine relies on 4 dedicated tables in the `modbm_core` schema:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `gl_accounts` | The Chart of Accounts | `account_code` (PK), `name`, `account_type`, `is_group`, `parent_account_code`, `is_system`, `is_active` |
| `gl_journal_entries` | Transaction headers | `journal_entry_id` (PK), `entry_number`, `entry_date`, `memo`, `source_type`, `source_id` |
| `gl_journal_lines` | Transaction lines (debits/credits) | `journal_line_id` (PK), `journal_entry_id` (FK), `account_code` (FK), `debit`, `credit`, `memo`, `party_type`, `party_id` |
| `gl_settings` | Global configuration | `id` (PK), `company_name`, `currency` |

> [!IMPORTANT]
> Because database migrations are run manually and automatically via `make migrate`, all schema definitions in `migrations/` use idempotent DDL (`CREATE TABLE IF NOT EXISTS`, and PL/pgSQL `DO` blocks for constraints).

## The Accounting Engine

The core logic resides in `GlService.postJournalEntry()`. This method acts as the impenetrable gatekeeper for all financial data entering the system.

### The Balance Invariant
Before any transaction is committed to the database, the engine verifies the **Balance Invariant**:
```typescript
Total Debits = Total Credits
```
This is enforced using strict decimal arithmetic (via `Decimal.js` or equivalent precise parsing) with a hardcoded tolerance of `0.005` to prevent floating-point drift. If an entry is unbalanced, a fatal `BadRequestException` is thrown, and the transaction is aborted.

### Account Validation Rules
The engine also enforces:
1. **Existence:** Every line must reference a valid `account_code`.
2. **Leaf Nodes Only:** You cannot post directly to a group account (`is_group = true`).
3. **Active Status:** You cannot post to a deactivated account (`is_active = false`).

### Entry Number Generation
Journal entries receive a sequential identifier formatted as `JE-YYYYMMDD-NNNN` (e.g., `JE-20260322-0001`). This sequence resets daily and is generated safely within a database transaction.

## Immutable Event Sourcing (Triggers)

Once a Journal Entry is committed, it forms the permanent financial record of the business. 
To guarantee absolute audit continuity, the `gl_journal_entries` and `gl_journal_lines` tables are protected by native **PostgreSQL BEFORE UPDATE OR DELETE triggers**. 

Any attempt to modify a posted journal line (even by an admin executing a raw SQL `UPDATE` statement) will be rejected by the database engine. Mistakes cannot be edited away; they must be reversed with a new, opposing Journal Entry.

## Integration with Subledgers

Other modules (like Invoices) interact with the GL by injecting the `GlService`.

### Non-Fatal Posting Strategy
When a subledger (e.g., Sales Invoice) attempts to post to the GL:
1. It looks up the necessary system accounts (e.g., Accounts Receivable, Revenue). 
2. It tags specific lines with `partyType: 'customer' | 'supplier'` and `partyId` (the supplier or customer UUID) for subledger reporting.
3. It constructs the balanced journal lines array.
4. It calls `glService.postJournalEntry()`.

Crucially, this call is wrapped in a `try/catch` block within the subledger. If the GL rejects the entry (e.g., due to a missing account), the error is caught, logged, and the invoice is still permitted to save its primary state. This prevents obscure GL configuration issues from paralyzing business operations.

### Outbox Integration
The system maintains the Outbox pattern. When an invoice succeeds, it emits an integration event. The event type has been updated from `invoice_created` to the more generic `gl_posted` to indicate that a financial transaction has occurred and is ready for downstream synchronization if required.

## Chart of Accounts Auto-Seeding

To ensure a seamless developer experience and reliable CI/CD pipelines, the GL module implements NestJS's `OnModuleInit` lifecycle hook.

Upon API startup:
1. The `CoaLoaderService` reads the default JSON file (`apps/api/src/gl/charts/au_standard.json`).
2. It checks if any accounts currently exist in the database.
3. **If empty:** It recursively parses the JSON, translates ERPNext `root_type` concepts into standard account types, auto-generates missing account codes, and persists the tree to the database. Essential system accounts (Accounts Receivable, Revenue, Tax) are explicitly flagged with `is_system = true` to protect them from deletion.
4. **If populated:** It silently skips the seeding process to preserve existing data.

## Authentication & Authorization

All GL endpoints are protected by JWT and Casbin RBAC.

*   **Resource:** `@CasbinResource('gl')`
*   **Roles:** 
    *   `finance`: inherits `viewer` (read-all across the app), plus `gl` read/write.
    *   `admin`: full access across the system.
    *   All other operational roles (`sales`, `warehouse`, etc.) have zero access to the `gl` resource.

## Testing Strategy

The GL engine requires absolute mathematical perfection. It is tested rigorously:

1.  **Mocked Database Proxy:** Unit tests (`gl.service.spec.ts`) utilize a programmable mock DB wrapped in a JS Proxy to accurately simulate Drizzle ORM's chainable interface without hitting a real Postgres instance.
2.  **Coverage:** The GL engine maintains near total coverage (> 95% Lines, 100% Functions), with extensive parameterized tests dedicated specifically to breaking the Balance Invariant.
3.  **Boundary Value Analysis:** Tests specifically probe zero-value entries, tiny floating-point discrepancies, and multiple line-item aggregations.
