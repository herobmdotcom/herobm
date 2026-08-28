# General Ledger Engine Guide

The NestJS General Ledger (GL) module (`apps/api/src/gl/`) provides a robust, double-entry accounting engine built directly into HeroBM. It replaces the need for an external financial backend (like ERPNext) for core operational accounting.

## Architecture

```
herobm_core schema (Postgres)
  │  Drizzle ORM (typed schema & mutations)
  ▼
NestJS API (apps/api/, port 3001)
  │  GlModule (Service, Controller, CoaLoader)
  ▼
Other Modules (Invoices) / HTTP JSON / Portal UI
```

The GL engine operates entirely within the native `herobm_core` schema, ensuring ACID compliance and referential integrity with other operational tables (like users and invoices).

## Core Responsibilities

1. **Chart of Accounts (COA) Management** — CRUD operations for accounts arranged in a tree hierarchy across 5 standard root types.
2. **Double-Entry Journal Posting** — Ensures every transaction strictly adheres to the fundamental accounting equation (Debits = Credits).
3. **Financial Reporting** — Aggregations for Trial Balance and General Ledger views.
4. **Idempotent Seeding** — Automatic ingestion of ERPNext-compatible COA JSON files during application initialization.

## Drizzle Schema

The engine relies on 4 dedicated tables in the `herobm_core` schema:

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

## Immutable Event Sourcing & Reversals

Once a Journal Entry is committed, it forms the permanent financial record of the business. 
To guarantee absolute audit continuity, financial transactions follow strict immutability principles:

1. **No Destructive Edits:** Mistakes or document cancellations cannot be edited away; they are reversed with a new, opposing Journal Entry linked to the source transaction.
2. **Audit Event Log Integration:** Every `postJournalEntry` execution emits an immutable `gl_posted` audit log event with full line payloads.
3. **Reconciliation Tracking:** Individual lines maintain bank matching references (`reconciliation_id`, `is_reconciled`) without altering the original posted monetary amounts.

## Integration with Subledgers

Other modules (like Invoices) interact with the GL by injecting the `GlService`.

### Atomic Transactional Posting (Strict Boundaries)
When a subledger (e.g., Sales Invoice, Goods Receipt) attempts to post to the GL:
1. It looks up the necessary system accounts (e.g., Accounts Receivable, Revenue). 
2. It tags specific lines with `partyType: 'customer' | 'supplier'` and `partyId` (the supplier or customer UUID) for subledger reporting.
3. It constructs the balanced journal lines array.
4. It calls `glService.postJournalEntry(lines, meta, tx)`.

**Crucially, all GL interactions MUST be completely atomic with their parent business operations.** 
To ensure this, `postJournalEntry` must be passed the ambient transaction object (`tx`) from the caller's `.transaction()` block. If the GL rejects the entry (e.g., due to an unbalanced journal or missing account configuration), an exception is thrown, and the entire transaction—including the invoice or inventory movement—is rolled back.

The system favors hard failure (consistency) over partial success (resilience with ledger gaps). The platform will not permit a business state to advance if the financial ledger cannot accurately record it.

### Outbox Integration
The system maintains the Outbox pattern. When an invoice succeeds, it emits an integration event. The event type has been updated from `invoice_created` to the more generic `gl_posted` to indicate that a financial transaction has occurred and is ready for downstream synchronization if required.

## Chart of Accounts Auto-Seeding & Template Formats

To ensure a seamless developer experience and reliable CI/CD pipelines, the GL module implements NestJS's `OnModuleInit` lifecycle hook.

HeroBM natively supports the ERPNext JSON Chart of Accounts format. Predefined regional templates (such as `au_standard.json` and `us_standard.json`) are stored in `apps/api/src/gl/charts/`. Additional country-specific templates can be obtained directly from the official [ERPNext Verified Chart of Accounts](https://github.com/frappe/erpnext/tree/develop/erpnext/accounts/doctype/account/chart_of_accounts/verified) repository and community templates in the [ERPNext Unverified Chart of Accounts](https://github.com/frappe/erpnext/tree/develop/erpnext/accounts/doctype/account/chart_of_accounts/unverified) directory.

Upon API startup:
1. The `CoaLoaderService` reads the default JSON file (`apps/api/src/gl/charts/au_standard.json`).
2. It checks if any accounts currently exist in the database.
3. **If empty:** It recursively parses the JSON, translates ERPNext `root_type` concepts into standard account types, auto-generates missing account codes, and persists the tree to the database. Essential system accounts (Accounts Receivable, Revenue, Tax) are explicitly flagged with `is_system = true` to protect them from deletion.
4. **If populated:** It silently skips the seeding process to preserve existing data.

## Statement of Cash Flows & Cash Parity Proof Engine

The Statement of Cash Flows engine (`apps/api/src/gl/gl-cash-flow.utils.ts` and `apps/api/src/gl/cash-flow.service.ts`) provides direct method cash flow classification paired with an independent control account parity proof.

### 1. Schema-Native Account Identification
Cash and bank accounts are identified using the schema flag:
```sql
SELECT gl_account_id, account_code, name, account_type, is_bank_account
FROM herobm_core.gl_accounts
WHERE is_group = false AND is_bank_account = true
```
This guarantees support across all Chart of Accounts formats (Anglo-Saxon 4-digit, French PCG Class 5, German DATEV SKR03/SKR04, and custom alphanumeric codes) without relying on hardcoded prefix heuristics.

### 2. Dual-Verification & Drift Calculation
The engine independently executes:
1. **Control Account Proof**: Sums $\sum (\text{debit} - \text{credit})$ across all bank accounts to derive `beginningCash` and `endingCash`, calculating $\Delta \text{Cash}_{\text{expected}} = \text{endingCash} - \text{beginningCash}$.
2. **Direct Decomposition**: Allocates journal entry lines touching cash accounts across Operating, Investing, and Financing activities.
3. **Parity Proof Invariant**:
   $$\text{drift} = (\text{Net Operating} + \text{Net Investing} + \text{Net Financing}) - \Delta \text{Cash}_{\text{expected}}$$
   If $|\text{drift}| < \$0.05$, the system verifies parity (`isReconciled = true`).

---

## Authentication & Authorization

All GL endpoints are protected by JWT and Casbin RBAC.

*   **Resource:** `@CasbinResource('gl')`
*   **Roles:** 
    *   `finance`: inherits `viewer` (read-all across the app), plus `gl` read/write.
    *   `admin`: full access across the system.
    *   All other operational roles (`sales`, `warehouse`, etc.) have zero access to the `gl` resource.

## Testing Strategy

The GL engine requires absolute mathematical perfection. It is tested rigorously:

1.  **Mocked Database Proxy:** Unit tests (`gl.service.spec.ts`, `gl-cash-flow.utils.spec.ts`) utilize programmable mock databases to accurately simulate Drizzle ORM queries without hitting real Postgres.
2.  **Coverage:** The GL engine maintains near total coverage (> 95% Lines, 100% Functions), with extensive parameterized tests dedicated specifically to breaking the Balance Invariant and verifying zero drift across randomized transaction sequences.
3.  **Boundary Value Analysis:** Tests specifically probe zero-value entries, compound split payments, inter-bank transfers, and international Chart of Accounts structures (PCG, SKR04, Alphanumeric).

