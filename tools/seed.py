"""
Data seeder for modbm_core tables.

Seeds UNIVERSAL application records AND the Chart of Accounts settings
(GL, tax categories, trading terms) from au_standard_settings.json.

Seeds UNIVERSAL application records — things needed regardless of whether
legacy data is imported.  Import-specific anchors (LEGACY-SALES, etc.) live
in dbt pre_hooks; inventory sync lives in a dbt post_hook.

Usage:
    python tools/seed.py              # seed all
    python tools/seed.py --users      # seed users only
    python tools/seed.py --products   # seed products + UOM only
    python tools/seed.py --verify-only # only run validation checks
    python tools/seed.py --dry-run    # show what would be seeded
"""

import subprocess
import sys
import os
import json
import uuid
from dotenv import load_dotenv

load_dotenv()

CONTAINER = os.environ.get("POSTGRES_CONTAINER", "postgres-custom")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_NAME = os.environ.get("POSTGRES_DB", "custom_app")


def psql(sql: str, capture: bool = False) -> str | None:
    """Execute SQL via podman exec psql."""
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-t", "-A",
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if capture:
        return result.stdout.strip()
    return None


def psql_sql(sql: str, env_vars: list[str] | None = None) -> None:
    """Execute a SQL string via podman exec psql with optional env var substitution."""
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
    ]
    if env_vars:
        for env_key in env_vars:
            val = os.environ.get(env_key, "")
            if val:
                cmd.extend(["-v", f"{env_key}={val}"])
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if result.stdout.strip():
        print(f"  {result.stdout.strip()}")


def psql_query(sql: str) -> list[dict]:
    """Execute SQL and return rows as list of dicts."""
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-t", "-A", "-c", f"SELECT row_to_json(t) FROM ({sql}) t"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        return []
    
    rows = []
    for line in result.stdout.strip().splitlines():
        if not line: continue
        try:
            rows.append(json.loads(line))
        except:
            continue
    return rows


def align_pkey(table: str, id_col: str, lookup_col: str, lookup_val: str, new_id: str, referencing_tables: list[tuple[str, str]]) -> None:
    """ safely migrates a primary key and its foreign keys to a new stable UUID using a Clone-Update-Delete pattern. """
    current_id = psql(f"SELECT {id_col} FROM modbm_core.{table} WHERE {lookup_col} = '{lookup_val}';", capture=True)
    if not current_id:
        return # New record, INSERT will handle it
    
    if current_id.lower() == new_id.lower():
        return # Already aligned
    
    print(f"  ALIGNING: Migrating {table}.{lookup_col}='{lookup_val}' from {current_id} to {new_id}...")
    
    # 0. Neutralize the old record's unique constraints to avoid collision during clone
    psql(f"UPDATE modbm_core.{table} SET {lookup_col} = '{lookup_val}_migration_old' WHERE {id_col} = '{current_id}';")
    
    # Also neutralize 'is_default' if it exists (specific to gst_categories)
    has_is_default = psql(f"SELECT 1 FROM information_schema.columns WHERE table_schema = 'modbm_core' AND table_name = '{table}' AND column_name = 'is_default';", capture=True)
    if has_is_default:
        psql(f"UPDATE modbm_core.{table} SET is_default = false WHERE {id_col} = '{current_id}';")

    # 1. Check if the target ID already exists in the table
    exists_new = psql(f"SELECT 1 FROM modbm_core.{table} WHERE {id_col} = '{new_id}';", capture=True)
    
    if not exists_new:
        # Create a clone of the old record with the new ID (using the ORIGINAL lookup_val)
        cols_query = f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'modbm_core' AND table_name = '{table}' AND column_name != '{id_col}' AND column_name != '{lookup_col}'"
        columns = [r['column_name'] for r in psql_query(cols_query)]
        
        cols_str = ""
        vals_str = ""
        if columns:
            cols_str = ", " + ", ".join(columns)
            vals_str = ", " + ", ".join(columns)
            
        psql(f"INSERT INTO modbm_core.{table} ({id_col}, {lookup_col}{cols_str}) SELECT '{new_id}', '{lookup_val}'{vals_str} FROM modbm_core.{table} WHERE {id_col} = '{current_id}';")
        print(f"    - Cloned record to {new_id}")
    
    # 2. Update all referencing foreign keys
    for ref_table, ref_col in referencing_tables:
        psql(f"UPDATE modbm_core.{ref_table} SET {ref_col} = '{new_id}' WHERE {ref_col} = '{current_id}';")
        print(f"    - Updated FK in {ref_table}.{ref_col}")
    
    # 3. Delete the old primary key record
    psql(f"DELETE FROM modbm_core.{table} WHERE {id_col} = '{current_id}';")
    print(f"    OK: {table} PKEY migration complete.")


# ── Seed Functions ──────────────────────────────────────────────────────────


def seed_users(dry_run: bool = False) -> None:
    """Seed dev users from environment variables."""
    required_vars = [
        "DEV_ADMIN_PASSWORD", "DEV_VIEWER_PASSWORD", "DEV_SALES_PASSWORD",
        "DEV_WAREHOUSE_PASSWORD", "DEV_PROCUREMENT_PASSWORD",
        "DEV_FINANCE_PASSWORD",
    ]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        print(f"  SKIP: Missing env vars: {', '.join(missing)}")
        print("  Set these in .env and re-run.")
        return

    if dry_run:
        print("  [DRY RUN] Would seed users: admin, viewer, sales, warehouse, procurement, finance")
        return

    sql = """
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    INSERT INTO modbm_core.users (username, password_hash, role) VALUES
        ('admin',       crypt(:'DEV_ADMIN_PASSWORD',       gen_salt('bf')), 'admin'),
        ('viewer',      crypt(:'DEV_VIEWER_PASSWORD',      gen_salt('bf')), 'viewer'),
        ('sales',       crypt(:'DEV_SALES_PASSWORD',       gen_salt('bf')), 'sales'),
        ('warehouse',   crypt(:'DEV_WAREHOUSE_PASSWORD',   gen_salt('bf')), 'warehouse'),
        ('procurement', crypt(:'DEV_PROCUREMENT_PASSWORD', gen_salt('bf')), 'procurement'),
        ('finance',     crypt(:'DEV_FINANCE_PASSWORD',     gen_salt('bf')), 'finance')
    ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role;
    """
    psql_sql(sql, env_vars=required_vars)
    print("  Seeded users: admin, viewer, sales, warehouse, procurement, finance")


def seed_products(dry_run: bool = False) -> None:
    """Seed the base UOM and system placeholder product."""
    if dry_run:
        print("  [DRY RUN] Would seed UOM 'EA' and SYSTEM-CUSTOM-LINE product")
        return

    sql = """
    INSERT INTO modbm_core.uom_dictionary (uom_code, description)
      VALUES ('EA', 'Each')
      ON CONFLICT (uom_code) DO NOTHING;

    INSERT INTO modbm_core.products (product_id, product_number, name)
      VALUES ('00000000-0000-0000-0000-000000000000', 'SYSTEM-CUSTOM-LINE', 'Custom Line Product')
      ON CONFLICT (product_id) DO UPDATE SET
        product_number = EXCLUDED.product_number,
        name = EXCLUDED.name;
    """
    psql_sql(sql)
    print("  Seeded UOM 'EA' and SYSTEM-CUSTOM-LINE product")




def seed_organization(dry_run: bool = False) -> None:
    """Seed a fallback organization record ONLY if none exists.
    The authoritative import from raw_abm.company is handled by dbt (import_organization)."""
    if dry_run:
        print("  [DRY RUN] Would seed fallback organization if none exists")
        return

    exists = psql("SELECT 1 FROM modbm_core.organization LIMIT 1;", capture=True)
    if exists:
        print("  SKIP: Organization record already exists.")
        return

    psql_sql("""
    INSERT INTO modbm_core.organization (organization_id, name)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'My Company')
    ON CONFLICT (organization_id) DO NOTHING;
    """)
    print("  Seeded default organization (fallback)")


# UUID v5 namespace matching the COA loader in apps/api/src/gl/coa-loader.service.ts
NAMESPACE_COA = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')

# Correct type mapping: the settings JSON uses 'gst_applies' but the schema
# was renamed in migration 0023 to 'tax_applies'. We normalise at seed time.
GST_TYPE_MAP = {'gst_applies': 'tax_applies'}


def load_coa_settings() -> dict | None:
    """Load au_standard_settings.json from the COA charts directory."""
    path = os.path.join('apps', 'api', 'src', 'gl', 'charts', 'au_standard_settings.json')
    if not os.path.exists(path):
        print(f"  WARN: COA settings file not found at {path}")
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def seed_coa_settings(dry_run: bool = False) -> None:
    """Seed GL settings, tax categories, and trading terms from au_standard_settings.json.
    Uses deterministic UUID v5 IDs identical to the COA loader in the API."""
    settings = load_coa_settings()
    if not settings:
        print("  SKIP: No COA settings file found.")
        return

    if dry_run:
        cats = settings.get('gst_categories', [])
        terms = settings.get('trading_terms', [])
        print(f"  [DRY RUN] Would seed {len(cats)} tax categories and {len(terms)} trading terms")
        return

    # --- Tax Categories ---
    categories = settings.get('gst_categories', [])
    for cat in categories:
        det_id = str(uuid.uuid5(NAMESPACE_COA, 'GST_CAT_' + cat['code']))
        normalised_type = GST_TYPE_MAP.get(cat['type'], cat['type'])
        is_default = 'true' if cat.get('is_default') else 'false'
        psql_sql(f"""
        INSERT INTO modbm_core.tax_categories (tax_category_id, code, title, type, rate, is_default)
        VALUES ('{det_id}', '{cat['code']}', '{cat['title']}', '{normalised_type}', '{cat['rate']}', {is_default})
        ON CONFLICT (code) DO UPDATE SET
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            rate = EXCLUDED.rate,
            is_default = EXCLUDED.is_default;
        """)
    print(f"  Seeded {len(categories)} tax categories")

    # --- Trading Terms ---
    terms = settings.get('trading_terms', [])
    for term in terms:
        det_id = str(uuid.uuid5(NAMESPACE_COA, 'TERM_' + term['code']))
        desc = term['description'].replace("'", "''")
        psql_sql(f"""
        INSERT INTO modbm_core.trading_terms (trading_terms_id, code, description, days, type)
        VALUES ('{det_id}', '{term['code']}', '{desc}', {term['days']}, '{term['type']}')
        ON CONFLICT (code) DO UPDATE SET
            description = EXCLUDED.description,
            days = EXCLUDED.days,
            type = EXCLUDED.type;
        """)
    print(f"  Seeded {len(terms)} trading terms")

    # --- GL Settings (with default account linking) ---
    base_currency = settings.get('base_currency', 'AUD')
    fiscal_month = settings.get('fiscal_year_start_month', 7)
    settings_id = '4e185bce-d31a-4caa-8462-73c261864eff'
    defaults = settings.get('defaults', {})

    # Build the SET clause for default account IDs, resolving account_code → gl_account_id
    default_cols = ''
    default_vals = ''
    update_set = ''
    account_mappings = [
        ('ar_account_code', 'default_ar_account_id'),
        ('ap_account_code', 'default_ap_account_id'),
        ('revenue_account_code', 'default_revenue_account_id'),
        ('cogs_account_code', 'default_cogs_account_id'),
        ('tax_account_code', 'default_tax_account_id'),
        ('expense_account_code', 'default_expense_account_id'),
    ]
    for json_key, col_name in account_mappings:
        code = defaults.get(json_key)
        if code:
            det_id = str(uuid.uuid5(NAMESPACE_COA, code))
            default_cols += f', {col_name}'
            default_vals += f", '{det_id}'"
            update_set += f", {col_name} = '{det_id}'"

    psql_sql(f"""
    INSERT INTO modbm_core.gl_settings (settings_id, fiscal_year_start_month, base_currency{default_cols})
    VALUES ('{settings_id}', {fiscal_month}, '{base_currency}'{default_vals})
    ON CONFLICT (settings_id) DO UPDATE SET
        fiscal_year_start_month = EXCLUDED.fiscal_year_start_month,
        base_currency = EXCLUDED.base_currency
        {update_set};
    """)
    print(f"  Seeded GL settings (base_currency={base_currency}, fiscal_month={fiscal_month})")


def seed_app_settings(dry_run: bool = False) -> None:
    """Seed default application settings if none exist."""
    if dry_run:
        print("  [DRY RUN] Would seed default app_settings")
        return

    exists = psql("SELECT 1 FROM modbm_core.app_settings LIMIT 1;", capture=True)
    if exists:
        print("  SKIP: app_settings record already exists.")
        return

    psql_sql("""
    INSERT INTO modbm_core.app_settings (settings_id, inventory_valuation_method, non_stock_billing_mode, credit_limit_behavior, setup_completed_at)
    VALUES (gen_random_uuid(), 'weighted_average', 'per_shipment', 'soft', NOW())
    ON CONFLICT DO NOTHING;
    """)
    print("  Seeded default app_settings")


# ERPNext root_type → our account_type, matching the API's COA loader
ROOT_TYPE_MAP = {
    'Asset': 'asset',
    'Liability': 'liability',
    'Equity': 'equity',
    'Income': 'revenue',
    'Expense': 'expense',
}


def seed_coa_accounts(dry_run: bool = False) -> None:
    """Seed the Chart of Accounts tree from au_standard.json.
    Uses deterministic UUID v5 IDs identical to the COA loader in the API."""
    coa_path = os.path.join('apps', 'api', 'src', 'gl', 'charts', 'au_standard.json')
    if not os.path.exists(coa_path):
        print(f"  SKIP: COA file not found at {coa_path}")
        return

    with open(coa_path, 'r', encoding='utf-8') as f:
        coa = json.load(f)

    if dry_run:
        print("  [DRY RUN] Would seed Chart of Accounts from au_standard.json")
        return

    # Check if COA already loaded
    existing = psql("SELECT count(*) FROM modbm_core.gl_accounts;", capture=True)
    if existing and int(existing) > 0:
        print(f"  SKIP: GL accounts already exist ({existing} records)")
        return

    # Flatten the tree into ordered inserts
    auto_code = [100]  # mutable counter for unnumbered accounts
    insert_rows = []

    def walk(nodes: dict, parent_code: str | None, inherited_type: str | None):
        for name, node in nodes.items():
            account_type = ROOT_TYPE_MAP.get(node.get('root_type', ''), inherited_type or 'asset')
            code = node.get('account_number', str(auto_code[0]))
            if 'account_number' not in node:
                auto_code[0] += 1
            is_group = node.get('is_group') == 1 or 'children' in node
            insert_rows.append({
                'code': code,
                'name': name,
                'account_type': account_type,
                'parent_code': parent_code,
                'is_group': is_group,
            })
            if 'children' in node:
                walk(node['children'], code, account_type)

    walk(coa.get('tree', {}), None, None)

    # Insert all accounts (two-pass: insert then link parents)
    # Pass 1: Insert all accounts
    for row in insert_rows:
        det_id = str(uuid.uuid5(NAMESPACE_COA, row['code']))
        safe_name = row['name'].replace("'", "''")
        is_group = 'true' if row['is_group'] else 'false'
        psql_sql(f"""
        INSERT INTO modbm_core.gl_accounts (gl_account_id, account_code, name, account_type, is_group, is_system, currency_code)
        VALUES ('{det_id}', '{row['code']}', '{safe_name}', '{row['account_type']}', {is_group}, true, 'AUD')
        ON CONFLICT (account_code) DO UPDATE SET
            name = EXCLUDED.name,
            account_type = EXCLUDED.account_type,
            is_group = EXCLUDED.is_group;
        """)

    # Pass 2: Link parent accounts
    for row in insert_rows:
        if row['parent_code']:
            parent_id = str(uuid.uuid5(NAMESPACE_COA, row['parent_code']))
            psql_sql(f"""
            UPDATE modbm_core.gl_accounts
            SET parent_account_id = '{parent_id}'
            WHERE account_code = '{row['code']}';
            """)

    print(f"  Seeded {len(insert_rows)} GL accounts from au_standard.json")


def load_report_config():
    path = os.path.join('packages', 'shared', 'reports-config.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)['reports']
    except Exception as e:
        print(f"ERROR: Failed to load report config from {path}: {e}")
        sys.exit(1)


def seed_reports(dry_run: bool = False) -> None:
    reports = load_report_config()
    
    if dry_run:
        print(f"  [DRY RUN] Would seed {len(reports)} report templates and hooks")
        return

    def read_escape(filename):
        path = os.path.join('tools', 'seeds', 'reports', filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read().replace("'", "''")
        except FileNotFoundError:
            print(f"  [WARN] Template file not found: {path}")
            return None

    reports_sql = []
    hooks_sql = []
    contexts_sql = []

    for r in reports:
        # Pre-seed alignment for reports based on slug
        ref_tables = [('report_contexts', 'report_id'), ('report_hook_assignments', 'report_id')]
        align_pkey('reports', 'id', 'slug', r['slug'], r['id'], ref_tables)

        template_content = read_escape(r['filename'])
        if template_content is None:
            continue
            
        reports_sql.append(f"('{r['id']}', '{r['slug']}', '{r['name']}', '{template_content}', '{r['output_name_pattern']}')")
        
        if 'hook' in r and r['hook']:
            # Handle standard context resolution
            ctx = r.get('context', 'default')
            hooks_sql.append(f"('{r['hook']}', '{r['id']}', '{ctx}')")
            
        if 'context' in r and r['context']:
            contexts_sql.append(f"('{r['id']}', '{r['context']}')")

    if not reports_sql:
        print("  SKIP: No valid report templates found to seed.")
        return

    sql = f"""
    INSERT INTO modbm_core.reports (id, slug, name, template, output_name_pattern)
    VALUES {', '.join(reports_sql)}
    ON CONFLICT (id) DO UPDATE SET
        template = EXCLUDED.template,
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        output_name_pattern = EXCLUDED.output_name_pattern;
    """
    
    if hooks_sql:
        sql += f"""
        INSERT INTO modbm_core.report_hook_assignments (hook_slug, report_id, context_slug)
        VALUES {', '.join(hooks_sql)}
        ON CONFLICT (hook_slug) DO UPDATE SET
            report_id = EXCLUDED.report_id,
            context_slug = EXCLUDED.context_slug;
        """
        
    if contexts_sql:
        sql += f"""
        INSERT INTO modbm_core.report_contexts (report_id, context)
        VALUES {', '.join(contexts_sql)}
        ON CONFLICT (report_id, context) DO NOTHING;
        """
        
    psql_sql(sql)
    print(f"  Seeded {len(reports_sql)} reports and {len(hooks_sql)} hook assignments.")


# ── Validation ──────────────────────────────────────────────────────────────


def validate_seeds() -> bool:
    """Comprehensive validation of all seed categories."""
    print("Validating seed integrity...\n")
    all_passed = True

    # 1. Organization
    org = psql("SELECT 1 FROM modbm_core.organization LIMIT 1;", capture=True)
    if org:
        print("  [PASS] Organization record exists")
    else:
        print("  [FAIL] No organization record found")
        all_passed = False

    # 2. Location (informational — created by Setup Wizard, not by seed.py)
    loc = psql("SELECT 1 FROM modbm_core.locations LIMIT 1;", capture=True)
    if loc:
        loc_count = psql("SELECT count(*) FROM modbm_core.locations;", capture=True)
        print(f"  [PASS] {loc_count} location(s) exist")
    else:
        print("  [INFO] No locations yet (created during Setup or ABM import)")

    # 3. System Product
    sys_prod = psql("SELECT 1 FROM modbm_core.products WHERE product_number = 'SYSTEM-CUSTOM-LINE';", capture=True)
    if sys_prod:
        print("  [PASS] SYSTEM-CUSTOM-LINE product exists")
    else:
        print("  [FAIL] SYSTEM-CUSTOM-LINE product missing")
        all_passed = False

    # 4. UOM
    uom = psql("SELECT 1 FROM modbm_core.uom_dictionary WHERE uom_code = 'EA';", capture=True)
    if uom:
        print("  [PASS] UOM 'EA' exists")
    else:
        print("  [FAIL] UOM 'EA' missing")
        all_passed = False

    # 4b. Tax Categories
    tax_count = psql("SELECT count(*) FROM modbm_core.tax_categories;", capture=True)
    if tax_count and int(tax_count) > 0:
        default_tax = psql("SELECT 1 FROM modbm_core.tax_categories WHERE is_default = true;", capture=True)
        if default_tax:
            print(f"  [PASS] {tax_count} tax category(ies) exist (default set)")
        else:
            print(f"  [FAIL] {tax_count} tax category(ies) exist but no default")
            all_passed = False
    else:
        print("  [FAIL] No tax categories found")
        all_passed = False

    # 4c. GL Accounts
    gl_count = psql("SELECT count(*) FROM modbm_core.gl_accounts;", capture=True)
    if gl_count and int(gl_count) > 0:
        print(f"  [PASS] {gl_count} GL account(s) exist")
    else:
        print("  [FAIL] No GL accounts found")
        all_passed = False

    # 5. Users
    user_count = psql("SELECT count(*) FROM modbm_core.users;", capture=True)
    if user_count and int(user_count) > 0:
        print(f"  [PASS] {user_count} user(s) exist")
    else:
        print("  [FAIL] No users found")
        all_passed = False

    # 6. Reports
    reports = load_report_config()
    report_failures = 0

    for r in reports:
        exists = psql(f"SELECT 1 FROM modbm_core.reports WHERE id = '{r['id']}' AND slug = '{r['slug']}';", capture=True)
        if not exists:
            print(f"  [FAIL] Report {r['slug']} (ID: {r['id']}) missing from DB.")
            report_failures += 1
            continue

        if 'hook' in r and r['hook']:
            hook_assignment = psql(f"SELECT report_id FROM modbm_core.report_hook_assignments WHERE hook_slug = '{r['hook']}';", capture=True)
            if not hook_assignment or hook_assignment != r['id']:
                print(f"  [FAIL] Hook '{r['hook']}' not correctly assigned to report '{r['slug']}'")
                report_failures += 1

        if 'context' in r and r['context']:
            context_exists = psql(f"SELECT 1 FROM modbm_core.report_contexts WHERE report_id = '{r['id']}' AND context = '{r['context']}';", capture=True)
            if not context_exists:
                print(f"  [FAIL] Context '{r['context']}' not registered for report '{r['slug']}'")
                report_failures += 1

    if report_failures == 0:
        print(f"  [PASS] All {len(reports)} reports, hooks, and contexts correctly configured")
    else:
        all_passed = False

    # Summary
    print()
    if all_passed:
        print("  [OK] ALL SEED CHECKS PASSED")
    else:
        print("  [FAIL] SEED VALIDATION FAILED — see failures above")

    # 7. App Settings
    app_settings_count = psql("SELECT count(*) FROM modbm_core.app_settings;", capture=True)
    if app_settings_count and int(app_settings_count) > 0:
        print(f"  [PASS] {app_settings_count} app_settings record(s) exist")
    else:
        print("  [FAIL] No app_settings record found")
        all_passed = False

    return all_passed


# ── Main ────────────────────────────────────────────────────────────────────


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    verify_only = "--verify-only" in sys.argv
    
    if verify_only:
        success = validate_seeds()
        sys.exit(0 if success else 1)

    users_only = "--users" in sys.argv
    products_only = "--products" in sys.argv
    seed_all = not users_only and not products_only

    if dry_run:
        print("Dry run mode -- no data will be written.\n")

    if seed_all or users_only:
        print("Seeding users...")
        seed_users(dry_run)

    if seed_all or products_only:
        print("Seeding products...")
        seed_products(dry_run)

    if seed_all:
        print("Seeding organization...")
        seed_organization(dry_run)

        print("Seeding Chart of Accounts...")
        seed_coa_accounts(dry_run)

        print("Seeding COA settings (tax categories, trading terms, GL)...")
        seed_coa_settings(dry_run)

        print("Seeding App settings...")
        seed_app_settings(dry_run)

        print("Seeding reports...")
        seed_reports(dry_run)
        
        if not dry_run:
            print()
            validate_seeds()

    if not dry_run:
        print("\nDone.")


if __name__ == "__main__":
    main()
