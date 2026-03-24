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
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
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
    """Seed inventory_levels from mart_inventory (if mart exists)."""
    # Check if mart table exists
    exists = psql(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public_marts' AND table_name = 'mart_inventory';",
        capture=True,
    )
    if not exists:
        print("  SKIP: public_marts.mart_inventory does not exist (run 'make elt' first)")
        return

    if dry_run:
        count = psql(
            "SELECT count(*) FROM public_marts.mart_inventory WHERE product_id IS NOT NULL;",
            capture=True,
        )
        print(f"  [DRY RUN] Would seed {count} inventory rows from mart_inventory")
        return

    sql = """
    INSERT INTO modbm_core.inventory_levels (
        product_id, location_no, quantity_on_hand,
        quantity_committed, quantity_on_order, modified_on
    )
    SELECT
        product_id,
        COALESCE(location_no, 'MAIN'),
        COALESCE(quantity_on_hand::numeric, 0),
        COALESCE(quantity_committed::numeric, 0),
        COALESCE(quantity_on_order::numeric, 0),
        NOW()
    FROM public_marts.mart_inventory
    WHERE product_id IS NOT NULL
    ON CONFLICT (product_id, location_no) DO NOTHING;
    """
    psql_sql(sql)
    print("  Seeded inventory_levels from mart_inventory")


def seed_products(dry_run: bool = False) -> None:
    """Products are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Products are imported via 'make import-legacy' (dbt import models)")


def seed_suppliers(dry_run: bool = False) -> None:
    """Suppliers are now imported via dbt import models (make import-legacy)."""
    print("  SKIP: Suppliers are imported via 'make import-legacy' (dbt import models)")


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

    if not dry_run:
        print("\nDone.")


if __name__ == "__main__":
    main()

