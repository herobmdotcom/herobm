import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const projectRoot = path.resolve(__dirname, '..');
const metaDir = path.join(projectRoot, 'apps/api/migrations/meta');
const journalFile = path.join(metaDir, '_journal.json');
const userDocFile = path.join(projectRoot, 'docs/user/database_schema.md');
const devDocFile = path.join(projectRoot, 'docs/technical/schema_reference.md');

const SCHEMA = 'herobm_core';

interface ColumnDef {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  default?: string;
}

interface ForeignKeyDef {
  name: string;
  tableFrom: string;
  tableTo: string;
  schemaTo?: string;
  columnsFrom: string[];
  columnsTo: string[];
  onDelete?: string;
  onUpdate?: string;
}

interface UniqueConstraintDef {
  name: string;
  columns: string[];
}

interface CheckConstraintDef {
  name: string;
  value: string;
}

interface TableDef {
  name: string;
  schema: string;
  columns: Record<string, ColumnDef>;
  foreignKeys: Record<string, ForeignKeyDef>;
  uniqueConstraints: Record<string, UniqueConstraintDef>;
  checkConstraints: Record<string, CheckConstraintDef>;
}

interface Snapshot {
  id: string;
  version: string;
  dialect: string;
  tables: Record<string, TableDef>;
}

interface DomainGroup {
  name: string;
  description: string;
  icon: string;
  tables: string[];
}

const DOMAIN_GROUPS: DomainGroup[] = [
  {
    name: 'CRM & Stakeholders',
    description: 'Accounts, contacts, relationship graphs, CRM projects, customer groups, and addresses.',
    icon: 'contacts',
    tables: [
      'actors',
      'contacts',
      'customers',
      'customer_groups',
      'customer_delivery_addresses',
      'actor_contact_links',
      'actor_actor_links',
      'actor_notes',
      'opportunities',
      'opportunity_notes',
      'opportunity_actors',
      'opportunity_contacts',
      'crm_activities',
      'projects',
      'project_notes',
      'project_actors',
      'project_contacts',
      'trading_terms',
    ],
  },
  {
    name: 'Products & Catalog',
    description: 'Item masters, product groups, units of measure, supplier pricing matrix, and bills of materials.',
    icon: 'inventory_2',
    tables: [
      'products',
      'product_groups',
      'product_suppliers',
      'product_uoms',
      'product_components',
      'product_default_bins',
      'product_images',
      'uom_dictionary',
      'discount_matrix',
    ],
  },
  {
    name: 'Sales & Distribution',
    description: 'Sales quotations, confirmed orders, pick lists, shipments, sales invoices, and customer credit notes.',
    icon: 'shopping_cart',
    tables: [
      'sales_orders',
      'sales_order_lines',
      'sales_order_line_items',
      'sales_order_picks',
      'sales_order_shipments',
      'sales_order_shipment_lines',
      'sales_order_returns',
      'sales_order_return_lines',
      'sales_credit_notes',
      'sales_credit_note_lines',
      'sales_invoices',
      'sales_invoice_lines',
      'backorders',
      'sales_events',
    ],
  },
  {
    name: 'Purchasing & Procurement',
    description: 'Purchase orders, goods receipts, purchase bills, vendor debit notes, returns, and supplier masters.',
    icon: 'local_shipping',
    tables: [
      'purchase_orders',
      'purchase_order_lines',
      'purchase_order_line_items',
      'purchase_invoices',
      'purchase_invoice_lines',
      'purchase_invoice_receipts',
      'purchase_debit_notes',
      'purchase_debit_note_lines',
      'purchase_debit_note_shipments',
      'purchase_order_returns',
      'purchase_order_return_lines',
      'purchase_order_return_shipments',
      'purchase_order_return_shipment_lines',
      'goods_received',
      'goods_received_lines',
      'suppliers',
      'supplier_groups',
      'supplier_expiries',
      'procurement_events',
    ],
  },
  {
    name: 'Warehouse & Inventory',
    description: 'Locations, warehouse zones, bin storage, stock ledger, stock balances, and internal transfer orders.',
    icon: 'warehouse',
    tables: [
      'locations',
      'zones',
      'bins',
      'bin_contents',
      'inventory_entries',
      'inventory_ledger',
      'inventory_levels',
      'transfer_orders',
      'transfer_order_lines',
      'transfer_order_picks',
      'transfer_order_shipments',
      'transfer_order_shipment_lines',
      'transfer_order_receipts',
      'transfer_order_receipt_lines',
      'inventory_events',
      'warehouse_events',
    ],
  },
  {
    name: 'Financials & General Ledger',
    description: 'Chart of accounts, double-entry journals, fiscal periods, bank reconciliation, tax positions, and payments.',
    icon: 'account_balance',
    tables: [
      'gl_accounts',
      'gl_journal_entries',
      'gl_journal_lines',
      'gl_reconciliations',
      'gl_settings',
      'gl_fiscal_periods',
      'gl_match_groups',
      'bank_statement_lines',
      'cost_centers',
      'activities',
      'csv_mapping_profiles',
      'reconciliation_rules',
      'payment_entries',
      'payment_lines',
      'payment_allocations',
      'financial_events',
      'reconciliation_events',
      'exchange_rates',
      'tax_categories',
      'tax_positions',
      'tax_position_mappings',
    ],
  },
  {
    name: 'Manufacturing & Work Orders',
    description: 'Production work orders, component allocations, and manufacturing picking tickets.',
    icon: 'precision_manufacturing',
    tables: [
      'work_orders',
      'work_order_components',
      'work_order_picks',
    ],
  },
  {
    name: 'System, Security & Telemetry',
    description: 'User access control, API keys, webhook outbox, PDF reports, async ELT pipeline jobs, and system event logs.',
    icon: 'admin_panel_settings',
    tables: [
      'users',
      'user_settings',
      'user_two_factor',
      'organization',
      'app_settings',
      'api_keys',
      'webhooks',
      'pdf_templates',
      'pdf_template_hooks',
      'pdf_template_contexts',
      'business_reports',
      'outbox',
      'email_outbox',
      'macros',
      'integrations',
      'pipeline_jobs',
      '_pipeline_jobs',
      'casbin_rule',
      'dashboard_timeline',
      'system_events',
      'user_events',
      'master_data_events',
      'business_report_events',
      'email_events',
      'integration_events',
      'group_events',
    ],
  },
];

function getLatestSnapshotFile(): string {
  if (fs.existsSync(journalFile)) {
    try {
      const journal = JSON.parse(fs.readFileSync(journalFile, 'utf-8'));
      if (Array.isArray(journal.entries) && journal.entries.length > 0) {
        const lastEntry = journal.entries[journal.entries.length - 1];
        const snapshotFile = path.join(metaDir, `${lastEntry.tag}_snapshot.json`);
        if (fs.existsSync(snapshotFile)) {
          return snapshotFile;
        }
      }
    } catch {
      // fallback to scanning
    }
  }

  // Fallback to sorting snapshot files
  const files = fs.readdirSync(metaDir).filter((f) => f.endsWith('_snapshot.json'));
  if (files.length === 0) {
    throw new Error(`No snapshot files found in ${metaDir}`);
  }
  files.sort().reverse();
  return path.join(metaDir, files[0]);
}

function loadSnapshot(): Snapshot {
  const snapshotPath = getLatestSnapshotFile();
  console.log(`Loading schema snapshot from: ${path.basename(snapshotPath)}`);
  const raw = fs.readFileSync(snapshotPath, 'utf-8');
  return JSON.parse(raw);
}

function tryGetLiveRowCounts(): Record<string, number> {
  const rowCounts: Record<string, number> = {};
  try {
    const query = `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname = '${SCHEMA}';`;
    const res = execSync(
      `podman exec -i postgres-custom psql -U postgres -d herobm -t -A -c "${query}"`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] },
    ).trim();

    if (res) {
      const lines = res.split('\n');
      for (const line of lines) {
        const [tbl, cnt] = line.split('|');
        if (tbl && cnt) {
          rowCounts[tbl.trim()] = parseInt(cnt.trim(), 10) || 0;
        }
      }
    }
  } catch {
    // Docker/Podman or DB not running, proceed without live row counts
  }
  return rowCounts;
}

function formatConstraintBadges(
  col: ColumnDef,
  table: TableDef,
): string {
  const badges: string[] = [];

  if (col.primaryKey) {
    badges.push('🔑 `PK`');
  }

  for (const fk of Object.values(table.foreignKeys || {})) {
    const idx = fk.columnsFrom.indexOf(col.name);
    if (idx !== -1) {
      const targetCol = fk.columnsTo[idx] || '';
      const onDel = fk.onDelete && fk.onDelete !== 'no action' ? ` (${fk.onDelete})` : '';
      badges.push(`🔗 \`${fk.tableTo}.${targetCol}\`${onDel}`);
    }
  }

  for (const uq of Object.values(table.uniqueConstraints || {})) {
    if (uq.columns.includes(col.name)) {
      badges.push('⚡ `UNIQUE`');
    }
  }

  for (const ck of Object.values(table.checkConstraints || {})) {
    if (ck.value.includes(col.name)) {
      badges.push('🏷️ `CHECK`');
    }
  }

  return badges.join(', ');
}

function generateMarkdown(snapshot: Snapshot, rowCounts: Record<string, number>): string {
  const tables = snapshot.tables;
  const tableEntries = Object.entries(tables).map(([k, v]) => ({
    fullKey: k,
    name: v.name,
    schema: v.schema || 'herobm_core',
    def: v,
  }));

  // Sort tables alphabetically
  tableEntries.sort((a, b) => a.name.localeCompare(b.name));

  const totalTables = tableEntries.length;
  let totalColumns = 0;
  let totalForeignKeys = 0;

  for (const t of tableEntries) {
    totalColumns += Object.keys(t.def.columns || {}).length;
    totalForeignKeys += Object.keys(t.def.foreignKeys || {}).length;
  }

  // Map each table to a domain
  const tableDomainMap: Record<string, string> = {};
  const domainTablesMap: Record<string, typeof tableEntries> = {};

  for (const group of DOMAIN_GROUPS) {
    domainTablesMap[group.name] = [];
    for (const tName of group.tables) {
      tableDomainMap[tName] = group.name;
    }
  }

  const uncategorized: typeof tableEntries = [];
  for (const t of tableEntries) {
    const domainName = tableDomainMap[t.name];
    if (domainName && domainTablesMap[domainName]) {
      domainTablesMap[domainName].push(t);
    } else {
      uncategorized.push(t);
    }
  }

  if (uncategorized.length > 0) {
    domainTablesMap['System, Security & Telemetry'].push(...uncategorized);
  }

  // -------------------------------------------------------------------------
  // Build Markdown Sections
  // -------------------------------------------------------------------------

  // 1. Table Directory Table
  let directoryRows = '';
  for (const group of DOMAIN_GROUPS) {
    const gTables = domainTablesMap[group.name] || [];
    if (gTables.length === 0) continue;

    for (const t of gTables) {
      const colCount = Object.keys(t.def.columns || {}).length;
      const fkCount = Object.keys(t.def.foreignKeys || {}).length;
      const pkCols = Object.values(t.def.columns || {})
        .filter((c) => c.primaryKey)
        .map((c) => `\`${c.name}\``)
        .join(', ') || '—';
      const liveRows = rowCounts[t.name] !== undefined ? `${rowCounts[t.name].toLocaleString()}` : '—';

      directoryRows += `| [${t.name}](#table-${t.name.replace(/_/g, '-')}) | ${group.name} | ${pkCols} | ${colCount} | ${fkCount} | ${liveRows} |\n`;
    }
  }

  // 2. Global Foreign Key Reference
  const fkList: Array<{
    fromTable: string;
    fromCol: string;
    toTable: string;
    toCol: string;
    onDelete?: string;
  }> = [];

  for (const t of tableEntries) {
    for (const fk of Object.values(t.def.foreignKeys || {})) {
      for (let i = 0; i < fk.columnsFrom.length; i++) {
        fkList.push({
          fromTable: t.name,
          fromCol: fk.columnsFrom[i],
          toTable: fk.tableTo,
          toCol: fk.columnsTo[i] || fk.columnsFrom[i],
          onDelete: fk.onDelete,
        });
      }
    }
  }

  fkList.sort((a, b) => a.fromTable.localeCompare(b.fromTable) || a.fromCol.localeCompare(b.fromCol));

  let fkRows = '';
  for (const fk of fkList) {
    const delRule = fk.onDelete && fk.onDelete !== 'no action' ? `\`${fk.onDelete}\`` : '`RESTRICT`';
    fkRows += `| \`${fk.fromTable}\` | \`${fk.fromCol}\` | \`${fk.toTable}\` | \`${fk.toCol}\` | ${delRule} |\n`;
  }

  // 3. Core ER Lineage Mermaid Diagram
  const coreTables = [
    'actors', 'contacts', 'customers', 'suppliers', 'products', 'opportunities',
    'sales_orders', 'sales_order_line_items', 'sales_invoices', 'sales_order_shipments',
    'purchase_orders', 'purchase_order_line_items', 'purchase_invoices', 'goods_received',
    'locations', 'bins', 'inventory_entries', 'inventory_ledger',
    'gl_accounts', 'gl_journal_entries', 'gl_journal_lines', 'payment_entries',
    'work_orders',
  ];

  const mermaidEdges = new Set<string>();
  for (const fk of fkList) {
    if (coreTables.includes(fk.fromTable) && coreTables.includes(fk.toTable)) {
      mermaidEdges.add(`    ${fk.toTable} -->|${fk.fromCol}| ${fk.fromTable}`);
    }
  }

  const mermaidChart = `\`\`\`mermaid
flowchart TD
    subgraph CRM ["CRM & Stakeholders"]
        actors["actors"]
        contacts["contacts"]
        customers["customers"]
        suppliers["suppliers"]
        opportunities["opportunities"]
    end

    subgraph Catalog ["Catalog"]
        products["products"]
    end

    subgraph Sales ["Sales & Fulfilment"]
        sales_orders["sales_orders"]
        sales_order_line_items["sales_order_lines"]
        sales_order_shipments["sales_shipments"]
        sales_invoices["sales_invoices"]
    end

    subgraph Procurement ["Purchasing & Receiving"]
        purchase_orders["purchase_orders"]
        purchase_order_line_items["purchase_order_lines"]
        goods_received["goods_received"]
        purchase_invoices["purchase_invoices"]
    end

    subgraph Inventory ["Warehouse & Ledger"]
        locations["locations"]
        bins["bins"]
        inventory_entries["inventory_entries"]
        inventory_ledger["inventory_ledger"]
    end

    subgraph GL ["General Ledger"]
        gl_accounts["gl_accounts"]
        gl_journal_entries["gl_journal_entries"]
        gl_journal_lines["gl_journal_lines"]
        payment_entries["payment_entries"]
    end

${Array.from(mermaidEdges).join('\n')}
\`\`\``;

  // 4. Per-Domain & Per-Table Detailed Reference
  let domainSections = '';

  for (const group of DOMAIN_GROUPS) {
    const gTables = domainTablesMap[group.name] || [];
    if (gTables.length === 0) continue;

    domainSections += `\n---\n\n## ${group.name}\n\n${group.description}\n\n`;

    for (const t of gTables) {
      const colEntries = Object.values(t.def.columns || {});
      const liveRowCount = rowCounts[t.name] !== undefined ? ` (${rowCounts[t.name].toLocaleString()} records)` : '';

      domainSections += `### Table: \`${SCHEMA}.${t.name}\`${liveRowCount} {#table-${t.name.replace(/_/g, '-')}}\n\n`;

      let colRows = '';
      colEntries.forEach((c, idx) => {
        const nullBadge = c.notNull ? 'NO' : 'YES';
        let defaultVal = c.default ? `\`${c.default}\`` : '—';
        if (defaultVal.length > 35) {
          defaultVal = defaultVal.slice(0, 32) + '...`';
        }
        const constraints = formatConstraintBadges(c, t.def) || '—';

        colRows += `| ${idx + 1} | \`${c.name}\` | \`${c.type}\` | ${nullBadge} | ${defaultVal} | ${constraints} |\n`;
      });

      domainSections += `| # | Column | Data Type | Nullable | Default | Constraints & Relationships |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${colRows}\n`;
    }
  }

  // -------------------------------------------------------------------------
  // Assemble Final Markdown Document
  // -------------------------------------------------------------------------
  const markdown = `---
id: database-schema
title: "Database Schema Reference"
description: "Comprehensive relational database schema reference, entity definitions, table columns, data types, constraints, and entity-relationship lineage for herobm_core."
category: "Developer"
order: 31
resource: "system"
action: "read"
routes:
  - "/admin/developers"
  - "/admin/system-logs"
tags: ["database", "schema", "tables", "postgres", "drizzle", "relations", "data-model", "lineage", "herobm_core"]
fields:
  table_name:
    title: "Table Name"
    summary: "Relational table identifier within herobm_core schema."
  primary_key:
    title: "Primary Key"
    summary: "Unique UUID identifier generated by gen_random_uuid()."
  foreign_key:
    title: "Foreign Key"
    summary: "Referential integrity link to another domain entity."
  column_type:
    title: "Column Type"
    summary: "PostgreSQL data type (e.g. uuid, text, numeric, jsonb, boolean, timestamptz)."
related:
  - "technical-operations"
  - "api-reference"
  - "webhooks-api"
---

# Database Schema Reference

The **HeroBM** application core database (\`${SCHEMA}\`) is a fully typed, relational PostgreSQL database managed via **Drizzle ORM**. It enforces strict referential integrity, domain state machines, event sourcing audit logs, and transactional outbox queuing.

---

## Architectural Principles & Standards

> [!NOTE]
> **1. UUID Primary Keys**: Every operational table uses a \`uuid\` primary key with \`gen_random_uuid()\` to prevent auto-increment enumeration vulnerabilities and facilitate safe distributed ingestion.

> [!IMPORTANT]
> **2. Enforced Foreign Keys & Referential Integrity**: Inter-entity relationships strictly enforce foreign keys. Cascading deletes are restricted to dependent line items (e.g., order lines, bin contents), while master dimension records use \`RESTRICT\` rules.

> [!TIP]
> **3. Microsoft CDM & Schema.org Conventions**: Column names follow snake_case naming aligned with common enterprise standards (\`account_number\`, \`currency_code\`, \`state_code\`, \`created_on\`, \`modified_on\`).

> [!WARNING]
> **4. Explicit State & No Magic Defaults**: Entity lifecycle states are strictly governed by application state machines and check constraints. No default values are used for critical financial states.

---

## Core Lineage & Entity Relationships

The following entity-relationship diagram illustrates the operational dependencies between CRM, Catalog, Sales, Purchasing, Warehouse, and General Ledger domains:

${mermaidChart}

---

## Schema Summary & Table Directory

The \`${SCHEMA}\` schema contains **${totalTables} tables**, **${totalColumns} columns**, and **${totalForeignKeys} foreign key relationships** across **${DOMAIN_GROUPS.length} business domains**:

| Table | Domain | Primary Key | Columns | Foreign Keys | Live Rows |
| :--- | :--- | :--- | :--- | :--- | :--- |
${directoryRows}
---

## Foreign Key Relationships Catalog

The table below catalogs all referential constraints across the application database:

| From Table | Column | To Table | Target Column | On Delete Action |
| :--- | :--- | :--- | :--- | :--- |
${fkRows}
${domainSections}
`;

  return markdown;
}

export function run() {
  console.log('Generating Database Schema Reference Documentation...');

  const snapshot = loadSnapshot();
  const rowCounts = tryGetLiveRowCounts();

  const markdown = generateMarkdown(snapshot, rowCounts);

  // 1. Write canonical documentation file
  fs.writeFileSync(userDocFile, markdown, 'utf-8');
  console.log(`✅ Generated Database Schema Reference: ${userDocFile}`);

  // 2. Remove obsolete duplicate in technical/ if it exists
  if (fs.existsSync(devDocFile)) {
    fs.unlinkSync(devDocFile);
    console.log(`🗑️ Removed duplicate ${devDocFile}`);
  }
}

if (process.argv[1] && (process.argv[1].endsWith('generate_schema_docs.ts') || process.argv[1].endsWith('generate_schema_docs.js'))) {
  run();
}
