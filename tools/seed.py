"""
Data seeder for modbm_core tables.

Seeds application tables from environment variables and/or mart data.
This is separate from schema migrations (tools/migrate.py) — migrations
handle DDL only, this script handles data population.

Usage:
    python tools/seed.py              # seed all
    python tools/seed.py --users      # seed users only
    python tools/seed.py --inventory  # seed inventory only
    python tools/seed.py --verify-only # only run validation checks
    python tools/seed.py --dry-run    # show what would be seeded
"""

import subprocess
import sys
import os
import json
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
    ON CONFLICT (username) DO NOTHING;
    """
    psql_sql(sql, env_vars=required_vars)
    print("  Seeded users: admin, viewer, sales, warehouse, procurement, finance")


def seed_inventory(dry_run: bool = False) -> None:
    """Inventory levels are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Inventory levels are imported via 'make import-legacy' (dbt import models)")


def sync_inventory_aggregates(dry_run: bool = False) -> None:
    """Consolidation task to fix inventory drift from native dbt imports."""
    if dry_run:
        print("  [DRY RUN] Would sync products.quantity_on_hand from inventory_ledger")
        return
    sql = """
    WITH ledger_totals AS (
      SELECT product_id, COALESCE(SUM(quantity), 0) as total_qty
      FROM modbm_core.inventory_ledger
      GROUP BY product_id
    )
    UPDATE modbm_core.products p
    SET quantity_on_hand = COALESCE(lt.total_qty, 0)
    FROM ledger_totals lt
    WHERE p.product_id = lt.product_id
    AND p.quantity_on_hand != COALESCE(lt.total_qty, 0);
    """
    psql_sql(sql)
    print("  Synced products.quantity_on_hand with inventory_ledger totals")


def seed_products(dry_run: bool = False) -> None:
    """Products are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Products are imported via 'make import-legacy' (dbt import models)")


def seed_suppliers(dry_run: bool = False) -> None:
    """Suppliers are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Suppliers are imported via 'make import-legacy' (dbt import models)")


def seed_gst_categories(dry_run: bool = False) -> None:
    """GST categories are now seeded from the Chart of Accounts settings JSON via coa-loader.service.ts during Setup."""
    print("  SKIP: GST categories are seeded via Setup Wizard / COA Loader")


def seed_organization(dry_run: bool = False) -> None:
    """Imports the organization singleton record from raw_abm.company or seeds a fallback."""
    # Check if raw_abm.company exists before attempting to seed
    exists = psql("SELECT 1 FROM information_schema.tables WHERE table_schema = 'raw_abm' AND table_name = 'company' LIMIT 1;", capture=True)
    
    if dry_run:
        if exists:
            print("  [DRY RUN] Would seed organization from raw_abm")
        else:
            print("  [DRY RUN] Would seed fallback organization (sterile environment)")
        return

    if exists:
        sql = """
        WITH src AS (
            SELECT 
                TRIM(company_name) as name,
                TRIM(COALESCE(company_url, '')) as website,
                TRIM(COALESCE(phone_number, '')) as phone,
                TRIM(COALESCE(tax_number, '')) as tax_number,
                TRIM(COALESCE(company_id, '')) as company_number,
                regexp_split_to_array(company_address, E'\\r?\\n') as addr_arr
            FROM raw_abm.company
            LIMIT 1
        )
        INSERT INTO modbm_core.organization (
            organization_id, name, website, phone, tax_number, company_number,
            address_line_1, address_line_2, city
        )
        SELECT 
            '00000000-0000-0000-0000-000000000000'::uuid,
            name, website, phone, tax_number, company_number,
            TRIM(COALESCE(addr_arr[1], '')),
            TRIM(COALESCE(addr_arr[2], '')),
            TRIM(COALESCE(addr_arr[3], ''))
        FROM src
        ON CONFLICT (organization_id) DO UPDATE SET 
            name = EXCLUDED.name,
            website = EXCLUDED.website,
            phone = EXCLUDED.phone,
            tax_number = EXCLUDED.tax_number,
            company_number = EXCLUDED.company_number,
            address_line_1 = EXCLUDED.address_line_1,
            address_line_2 = EXCLUDED.address_line_2,
            city = EXCLUDED.city;
        """
        psql_sql(sql)
        print("  Seeded organization details from raw_abm.company")
    else:
        # Sterile fallback
        sql = """
        INSERT INTO modbm_core.organization (organization_id, name)
        VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'My Company')
        ON CONFLICT (organization_id) DO NOTHING;
        """
        psql_sql(sql)
        print("  Seeded default organization (Sterile Fallback)")


def seed_system_records(dry_run: bool = False, base_currency: str = 'EUR', loc_code: str = 'HQ') -> None:
    if dry_run:
        print(f"  [DRY RUN] Would seed system records with base currency {base_currency}")
        return
    # Resolve the location ID gracefully
    loc_id_res = psql(f"SELECT location_id FROM modbm_core.locations WHERE code = '{loc_code}';", capture=True)
    
    if loc_id_res:
        resolved_loc_id = loc_id_res
        print(f"  Using existing location {loc_code} ({resolved_loc_id})")
    else:
        resolved_loc_id = '00000000-0000-0000-0000-000000000100'
        psql_sql(f"""
        INSERT INTO modbm_core.locations (location_id, code, name)
          VALUES ('{resolved_loc_id}', '{loc_code}', 'Main Headquarters')
          ON CONFLICT (location_id) DO UPDATE SET 
            code = EXCLUDED.code,
            name = EXCLUDED.name;
        """)

    sql = f"""
    INSERT INTO modbm_core.uom_dictionary (uom_code, description)
      VALUES ('EA', 'Each')
      ON CONFLICT (uom_code) DO NOTHING;

    INSERT INTO modbm_core.products (product_id, product_number, name) 
      VALUES ('00000000-0000-0000-0000-000000000000', 'SYSTEM-CUSTOM-LINE', 'Custom Line Product') 
      ON CONFLICT (product_id) DO UPDATE SET 
        product_id = EXCLUDED.product_id,
        product_number = EXCLUDED.product_number;

    INSERT INTO modbm_core.sales_orders (sales_order_id, order_number, state_code, currency_code, fulfillment_location_id)
      VALUES (
        '00000000-0000-0000-0000-000000000001', 
        'LEGACY-SALES', 
        'legacy', 
        '{base_currency}',
        '{resolved_loc_id}'
      )
      ON CONFLICT (sales_order_id) DO UPDATE SET 
        order_number = EXCLUDED.order_number,
        state_code = EXCLUDED.state_code;

    INSERT INTO modbm_core.sales_order_lines (sales_order_line_id, sales_order_id, line_number, product_id, amount, total_amount, quantity, price_per_unit, tax, discount_percentage, fulfillment_location_id)
      VALUES (
        '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000000', 0, 0, 0, 0, 0, 0,
        '{resolved_loc_id}'
      )
      ON CONFLICT (sales_order_line_id) DO NOTHING;

    INSERT INTO modbm_core.purchase_orders (purchase_order_id, order_number, state_code, currency_code)
      VALUES ('00000000-0000-0000-0000-000000000002', 'LEGACY-PURCHASE', 'legacy', '{base_currency}')
      ON CONFLICT (purchase_order_id) DO UPDATE SET 
        order_number = EXCLUDED.order_number;

    INSERT INTO modbm_core.purchase_order_lines (purchase_order_line_id, purchase_order_id, line_number, product_id, amount, total_amount, quantity, price_per_unit, tax, discount_percentage)
      VALUES (
        '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000000', 0, 0, 0, 0, 0, 0
      )
      ON CONFLICT (purchase_order_line_id) DO NOTHING;

    -- Anchor exchange rate for the base currency
    INSERT INTO modbm_core.exchange_rates (currency_code, currency_name, buy_rate, sell_rate)
      VALUES ('{base_currency}', '{base_currency}', 1.0, 1.0)
      ON CONFLICT (currency_code) DO UPDATE SET buy_rate = 1.0, sell_rate = 1.0;
    """
    psql_sql(sql)


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


def validate_report_setup() -> bool:
    """Verifies that the database matches the shared report config."""
    print("Verifying report setup integrity...")
    reports = load_report_config()
    all_passed = True

    for r in reports:
        # 1. Check report exists
        exists = psql(f"SELECT 1 FROM modbm_core.reports WHERE id = '{r['id']}' AND slug = '{r['slug']}';", capture=True)
        if not exists:
            print(f"  [FAIL] Report {r['slug']} (ID: {r['id']}) missing from DB.")
            all_passed = False
            continue

        # 2. Check hook assignment if applicable
        if 'hook' in r and r['hook']:
            hook_assignment = psql(f"SELECT report_id FROM modbm_core.report_hook_assignments WHERE hook_slug = '{r['hook']}';", capture=True)
            if not hook_assignment or hook_assignment != r['id']:
                print(f"  [FAIL] Hook '{r['hook']}' not correctly assigned to report '{r['slug']}' (Expected: {r['id']}, Found: {hook_assignment})")
                all_passed = False

        # 3. Check context registration
        if 'context' in r and r['context']:
            context_exists = psql(f"SELECT 1 FROM modbm_core.report_contexts WHERE report_id = '{r['id']}' AND context = '{r['context']}';", capture=True)
            if not context_exists:
                print(f"  [FAIL] Context '{r['context']}' not registered for report '{r['slug']}'")
                all_passed = False

    if all_passed:
        print("  [PASS] All reports, hooks, and contexts are correctly configured.")
    else:
        print("  [FAIL] Report setup integrity check failed.")
        
    return all_passed


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    verify_only = "--verify-only" in sys.argv
    
    if verify_only:
        success = validate_report_setup()
        sys.exit(0 if success else 1)

    users_only = "--users" in sys.argv
    inventory_only = "--inventory" in sys.argv
    products_only = "--products" in sys.argv
    suppliers_only = "--suppliers" in sys.argv
    seed_all = not users_only and not inventory_only and not products_only and not suppliers_only

    if dry_run:
        print("Dry run mode -- no data will be written.\n")

    if seed_all or users_only:
        print("Seeding users...")
        seed_users(dry_run)

    if seed_all or inventory_only:
        print("Seeding inventory...")
        seed_inventory(dry_run)
        print("Syncing inventory aggregates...")
        sync_inventory_aggregates(dry_run)

    if seed_all or products_only:
        print("Seeding products...")
        seed_products(dry_run)

    if seed_all or suppliers_only:
        print("Seeding suppliers...")
        seed_suppliers(dry_run)

    if seed_all:
        base_currency = os.environ.get("HOME_CURRENCY", "AUD")

        seed_system_records(dry_run, base_currency, os.environ.get("DEFAULT_FULFILLMENT_LOCATION_CODE", "HQ"))
        seed_organization(dry_run)
        seed_gst_categories(dry_run)
        seed_reports(dry_run)
        
        if not dry_run:
            validate_report_setup()

    if not dry_run:
        print("\nDone.")


if __name__ == "__main__":
    main()
