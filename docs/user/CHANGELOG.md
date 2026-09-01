# User Help Documentation Changelog

This changelog records all synchronization audits and updates to `docs/user/`. Each entry documents the audited Git commit range, covered topics, and the updated synchronization checkpoint.

---

## [2026-09-01] - Chart of Accounts Local File Upload & Preset Import Documentation

**Topics Updated:**
- **`docs/user/admin_groups_settings.md`**:
  - Documented direct client-side local JSON file upload option in the "Import CoA" modal.
  - Documented server preset scanning (`apps/api/src/gl/charts/`) and updated step-by-step workflow.
- **`docs/user/general_ledger.md`**:
  - Documented browser file upload and server presets for ERPNext Chart of Accounts templates.

---

## [2026-08-27] - ERPNext Chart of Accounts Import Documentation

**Topics Updated:**
- **`docs/user/general_ledger.md`**:
  - Documented ERPNext JSON format support for Chart of Accounts (COA) import.
  - Linked built-in presets and external verified/unverified ERPNext Chart of Accounts repositories.
  - Added step-by-step workflow for importing and managing Chart of Accounts in Financial Settings.
- **`docs/user/admin_groups_settings.md`**:
  - Added Chart of Accounts import details under Financial Settings description and step-by-step workflows.

---

## [2026-08-24] - System Architecture Help Topic

**Topics Updated:**
- **`docs/user/architecture.md` (NEW)**:
  - Created dedicated Architecture overview guide under the Overview category.
  - Documented high-level system topology (Mermaid diagram), monorepo components (`apps/*`, `packages/*`), Tri-Schema database model (`public_staging`, `public_marts`, `herobm_core`), double-entry General Ledger engine, double-entry perpetual inventory engine, deterministic state machines, transactional outbox relay, Casbin RBAC security model, Typst document compilation, and local IT operations / tiered verification hierarchy.
- **`docs/user/overview.md`**:
  - Linked new `architecture` topic in the `related` topics metadata.

---

## [2026-08-22] - Comprehensive Feature Sync & Checkpoint Baseline

**Audited Range:** `66706a03..fb61ff05` (and working tree changes)  
**Synchronized By:** Lead AI System Architect  
**Checkpoint SHA:** `fb61ff05`

### Summary of Documentation Updates:

- **`docs/user/fiscal_periods.md` (NEW)**:
  - Documented the new Fiscal Periods module (`/fiscal-periods`).
  - Explained period generation, period status definitions (`Open`, `Soft Locked`, `Hard Closed`), and back-dated posting prevention.
- **`docs/user/general_ledger.md`**:
  - Added new route `/general-ledger/journal-entries/new`.
  - Added section explaining fiscal period locking invariants.
  - Added Subledger Reconciliation (`/gl/subledger-reconciliation`) and Trial Balance zero-sum integrity checks.
- **`docs/user/admin_groups_settings.md`**:
  - Added routes for Email Settings (`/admin/email/settings`), Email Outbox (`/admin/email/outbox`), Event Queue (`/admin/event-queue`), System Logs (`/admin/system-logs`), Version (`/admin/version`), and Template Editor (`/admin/settings/pdf-templates/new`).
  - Documented outbound SMTP configuration, queue monitoring, and Sales Order Analysis Codes settings.
- **`docs/user/sales_order_management.md`**:
  - Documented direct document emailing via the `EmailDocumentDialog`.
  - Documented structured Sales Order Analysis Codes and custom fields.
  - Documented discount percentage bounds enforcement (0% to 100%).
- **`docs/user/purchase_order_management.md`**:
  - Documented supplier purchasing hold warnings and confirmation restrictions.
  - Documented direct document emailing for POs.
  - Documented one-click Return to Vendor (`Create Return`) shortcut.
- **`docs/user/shipping.md` & `docs/user/shipments.md`**:
  - Documented carrier shipping label printing (new Typst template).
  - Documented customer shipping docket emailing.
- **`docs/user/purchase_returns_debit_notes.md`**:
  - Added route `/purchase-orders/returns/new`.
  - Documented Typst PDF generation and emailing for Purchase Return Slips and Purchase Debit Notes.
- **`docs/user/crm.md`**:
  - Added routes `/crm/actors/new`, `/crm/contacts/new`, `/crm/projects/new`.
  - Documented Contact Roles (`Billing`, `Delivery`, `Purchasing`, `Sales`, `General`) and the Quick Contact slide-over (`ContactSlideOver`).
- **`docs/user/technical_operations.md`**:
  - Documented the modular Developer Hub (API Keys with role selection, Rate Limits, Webhook Endpoints, and Secret Modal).
- **`docs/user/receiving.md`**:
  - Added route `/receiving/new`.
- **`docs/user/reconciliations.md`**:
  - Added route `/reconciliations/new` and subledger reconciliation details.
- **`docs/user/dynamic_reporting.md`**:
  - Added route `/reporting/config/new`.

---

## [2026-08-20] - Baseline Documentation Revision

**Audited Range:** Initial baseline up to `66706a03`  
**Topics:** Master set of 34 operational and technical documentation topics.
