"""
Data seeder for modbm_core tables.

Seeds application tables from environment variables and/or mart data.
This is separate from schema migrations (tools/migrate.py) — migrations
handle DDL only, this script handles data population.

Usage:
    python tools/seed.py              # seed all
    python tools/seed.py --users      # seed users only
    python tools/seed.py --inventory  # seed inventory only
    python tools/seed.py --dry-run    # show what would be seeded
"""

import subprocess
import sys
import os

CONTAINER = "postgres-custom"
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


def seed_products(dry_run: bool = False) -> None:
    """Products are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Products are imported via 'make import-legacy' (dbt import models)")


def seed_suppliers(dry_run: bool = False) -> None:
    """Suppliers are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Suppliers are imported via 'make import-legacy' (dbt import models)")




def seed_gst_categories(dry_run: bool = False) -> None:
    if dry_run:
        print("  [DRY RUN] Would seed GST categories")
        return
    sql = """
    INSERT INTO modbm_core.gst_categories (code, title, type, rate, is_default) VALUES
        ('GST', 'GST 9%', 'gst_applies', '9', true),
        ('ZR', 'Zero Rated', 'zero_rated', '0', false),
        ('EXE', 'Exempt', 'exempt', '0', false)
    ON CONFLICT (code) DO UPDATE SET rate = EXCLUDED.rate, title = EXCLUDED.title, type = EXCLUDED.type, is_default = EXCLUDED.is_default;
    """
    psql_sql(sql)

def seed_system_records(dry_run: bool = False) -> None:
    if dry_run:
        print("  [DRY RUN] Would seed system records")
        return
    sql = """
    INSERT INTO modbm_core.products (product_id, product_number, name) 
      VALUES ('00000000-0000-0000-0000-000000000000', 'SYSTEM-CUSTOM-LINE', 'Custom Line Product') 
      ON CONFLICT (product_id) DO UPDATE SET product_number = 'SYSTEM-CUSTOM-LINE';


    INSERT INTO modbm_core.sales_orders (sales_order_id, order_number, state_code)
      VALUES ('00000000-0000-0000-0000-000000000001', 'LEGACY-SALES', 'legacy')
      ON CONFLICT DO NOTHING;

    INSERT INTO modbm_core.sales_order_lines (sales_order_line_id, sales_order_id, line_number, product_id, amount, total_amount, quantity, price_per_unit, tax, discount_percentage)
      VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-000000000000', 0, 0, 0, 0, 0, 0)
      ON CONFLICT DO NOTHING;

    INSERT INTO modbm_core.purchase_orders (purchase_order_id, order_number, state_code)
      VALUES ('00000000-0000-0000-0000-000000000002', 'LEGACY-PURCHASE', 'legacy')
      ON CONFLICT DO NOTHING;

    INSERT INTO modbm_core.purchase_order_lines (purchase_order_line_id, purchase_order_id, line_number, product_id, amount, total_amount, quantity, price_per_unit, tax, discount_percentage)
      VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', 1, '00000000-0000-0000-0000-000000000000', 0, 0, 0, 0, 0, 0)
      ON CONFLICT DO NOTHING;
    """
    psql_sql(sql)


def seed_reports(dry_run: bool = False) -> None:
    if dry_run:
        print("  [DRY RUN] Would seed report templates")
        return

    def read_escape(filename):
        path = os.path.join('tools', 'seeds', 'reports', filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read().replace("'", "'")
        except FileNotFoundError:
            return ""

    q = read_escape('sales-quote.typ')
    p = read_escape('picking-slip.typ')
    i = read_escape('sales-invoice.typ')

    if not q or not p or not i:
        print("  [WARN] Missing robust report templates in tools/seeds/reports/, skipping...")
        return

    # Use single quotes properly escaped in python f-string inside SQL string
    sql = f"""
    INSERT INTO modbm_core.reports (id, slug, name, template, output_name_pattern) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'sales-order-quote', 'Sales Order Quote', '{q}', 'Quote-${{orderNumber}}.pdf'),
        ('a0000000-0000-0000-0000-000000000002', 'picking-slip-template', 'Picking Slip', '{p}', 'PickingSlip-${{orderNumber}}.pdf'),
        ('a0000000-0000-0000-0000-000000000003', 'sales-invoice-template', 'Sales Invoice', '{i}', 'Invoice-${{orderNumber}}.pdf')
    ON CONFLICT (id) DO UPDATE SET
        template = EXCLUDED.template,
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        output_name_pattern = EXCLUDED.output_name_pattern;

    INSERT INTO modbm_core.report_hook_assignments (hook_slug, report_id) VALUES
        ('sales-order-quote', 'a0000000-0000-0000-0000-000000000001'),
        ('picking-slip',      'a0000000-0000-0000-0000-000000000002'),
        ('sales-invoice',     'a0000000-0000-0000-0000-000000000003')
    ON CONFLICT (hook_slug) DO UPDATE SET
        report_id = EXCLUDED.report_id;

    INSERT INTO modbm_core.report_contexts (report_id, context) VALUES
        ('a0000000-0000-0000-0000-000000000001', 'sales-order'),
        ('a0000000-0000-0000-0000-000000000002', 'picking-slip'),
        ('a0000000-0000-0000-0000-000000000003', 'sales-invoice')
    ON CONFLICT (report_id, context) DO NOTHING;
    """
    psql_sql(sql)

def main() -> None:
    dry_run = "--dry-run" in sys.argv
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

    if seed_all or products_only:
        print("Seeding products...")
        seed_products(dry_run)

    if seed_all or suppliers_only:
        print("Seeding suppliers...")
        seed_suppliers(dry_run)


    if seed_all:
        seed_system_records(dry_run)
        seed_gst_categories(dry_run)
        seed_reports(dry_run)

    if not dry_run:
        print("\nDone.")


if __name__ == "__main__":
    main()

