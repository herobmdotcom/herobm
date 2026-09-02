# ops-portal Translations (`en.json`)

This document describes the structure and conventions for the i18n translation file.

## Architecture

The app uses [next-intl](https://next-intl.dev/) with **strict type checking** enabled. This means every key referenced via `t('key')` or `useTranslations('namespace')` must exist in `en.json` — otherwise TypeScript will reject it at build time.

### Validation Command

```bash
npm run typecheck -w apps/ops-portal
```

If this fails with `TS2345` errors referencing `NamespacedMessageKeys`, it means the translation key is missing from `en.json`.

## Namespace Structure

| Namespace | Scope | Example Keys |
|---|---|---|
| `common` | Shared across all pages — buttons, columns, states, errors, filters | `common.save`, `common.columns.name`, `common.states.active` |
| `customers` | Customer customers module | `customers.title`, `customers.columns.customerNumber` |
| `suppliers` | Supplier management | `suppliers.title`, `suppliers.compliance.reason` |
| `products` | Product catalogue & storage | `products.generalInfo`, `products.storage.addBinLink` |
| `salesOrders` | Sales order workflow | `salesOrders.lineItems`, `salesOrders.buttons.copyOrder` |
| `purchaseOrders` | Purchase order workflow | `purchaseOrders.lineItems`, `purchaseOrders.flow.title` |
| `inventory` | Inventory ledger & movements | `inventory.title`, `inventory.ledger.columns.product` |
| `bins` | Bin/location management | `bins.title`, `bins.columns.locationName` |
| `picking` | Pick/pack/ship workflow | `picking.title`, `picking.actions.pickAll` |
| `gl` | General Ledger / Journal entries | `gl.title`, `gl.columns.debit` |
| `dashboard` | Dashboard & quick actions | `dashboard.title`, `dashboard.timeline.relativeUnits.h` |
| `sidebar` | Navigation sidebar | `sidebar.items.dashboard`, `sidebar.groups.admin` |
| `admin` | Admin module (settings, reporting, groups, events, logs) | `admin.settings.title`, `admin.reporting.form.labels.displayName` |
| `setup` | Initial setup wizard | `setup.title`, `setup.fields.companyName` |
| `toast` | Legacy toast messages (prefer namespace-local `toasts.*`) | `toast.orderArchived` |
| `confirm` | Confirmation dialog text | `confirm.archiveOrder` |

### Sub-namespaces within `admin`

The `admin` namespace has deep structure:

```
admin
├── customerGroups    # Customer customer group CRUD
├── productGroups    # Product group CRUD
├── supplierGroups   # Supplier group CRUD
├── common           # Shared admin strings (notConfigured, defDiscount, etc.)
├── eventQueue       # Outbox event monitoring
├── systemLogs       # System log viewer
├── reporting
│   ├── form         # Template editor (labels, placeholders, toasts, buttons)
│   ├── hooks        # Hook assignment table
│   └── grid         # Template list grid
└── settings         # Company settings (sections, labels, placeholders, GL, GST, rates, UOM)
```

## Conventions

### 1. Namespace Binding

Always bind to the most specific namespace:

```tsx
// ✅ Good — scoped to the module
const t = useTranslations('salesOrders');
t('buttons.copyOrder');

// ✅ Good — for shared keys
const tCommon = useTranslations('common');
tCommon('save');

// ✅ OK — root-level for cross-cutting keys  
const t = useTranslations();
t('products.storage.toastLinkUpdated');
```

### 2. Key Naming

Use consistent sub-key groupings within each namespace:

| Group | Purpose | Example |
|---|---|---|
| `title`, `subtitle` | Page/section headings | `salesOrders.title` |
| `columns.*` | Data grid column headers | `common.columns.name` |
| `buttons.*` | Action buttons | `salesOrders.buttons.createOrder` |
| `labels.*` | Form field labels | `admin.settings.labels.companyName` |
| `placeholders.*` | Input placeholder text | `admin.settings.placeholders.email` |
| `toasts.*` | Toast notification messages | `admin.settings.toasts.gstCreated` |
| `errors.*` | Error messages | `common.errors.failedToCreateOrder` |
| `states.*` | Status labels | `common.states.active` |
| `actions.*` | Action labels (edit, delete) | `admin.settings.actions.create` |
| `sections.*` | Section headings within a page | `admin.settings.sections.company` |
| `confirmations.*` | Confirmation dialog text | `admin.settings.confirmations.deleteGst` |

### 3. Adding New Keys

When adding a new translation key:

1. **Identify the namespace** — Does the key belong to an existing module (`salesOrders`, `products`, etc.) or is it cross-cutting (`common`)?
2. **Use the correct sub-group** — Follow the table above.
3. **Run typecheck** — `npm run typecheck -w apps/ops-portal` to confirm the key is recognized.
4. **Avoid duplication** — Check if a similar key already exists in `common` before creating a module-specific one.

### 4. Shared vs. Module-Specific

- Put strings used in **2+ modules** under `common` (e.g., column headers, button labels, states).
- Put strings specific to **one page/feature** under that feature's namespace.
- **Do not** create top-level namespaces for one-off concerns. Nest them instead (e.g., `admin.settings`, not `settings`).
