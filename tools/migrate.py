"""
Migration runner for modbm_core schema.

Applies SQL migration files from apps/api/migrations/ in order,
tracking which have already been applied in modbm_core.schema_migrations.

Usage:
    python tools/migrate.py              # apply pending migrations
    python tools/migrate.py --status     # show migration status
    python tools/migrate.py --dry-run    # show what would be applied
"""

import subprocess
import sys
import os
import glob

MIGRATIONS_DIR = os.path.join("apps", "api", "migrations")
CONTAINER = "postgres-custom"
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_NAME = os.environ.get("POSTGRES_DB", "custom_app")


def psql(sql: str, capture: bool = False) -> str | None:
    """Execute SQL via docker exec psql."""
    cmd = [
        "docker", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-t", "-A",  # tuples-only, unaligned output
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if capture:
        return result.stdout.strip()
    return None


def psql_file(filepath: str) -> None:
    """Execute a SQL file via docker exec psql."""
    with open(filepath, "r", encoding="utf-8") as f:
        sql = f.read()
    cmd = [
        "docker", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
    ]
    # Pass known env vars as psql variables for migration seeding
    for env_key in [
        "DEV_ADMIN_PASSWORD", "DEV_SALES_PASSWORD",
        "DEV_WAREHOUSE_PASSWORD", "DEV_PROCUREMENT_PASSWORD",
    ]:
        val = os.environ.get(env_key, "")
        if val:
            cmd.extend(["-v", f"{env_key}={val}"])
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR applying migration:\n{result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if result.stdout.strip():
        print(f"  {result.stdout.strip()}")


def ensure_tracking_table() -> None:
    """Create the schema_migrations tracking table if it doesn't exist."""
    psql("""
        CREATE TABLE IF NOT EXISTS modbm_core.schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)


def get_applied() -> set[str]:
    """Return set of already-applied migration filenames."""
    raw = psql("SELECT filename FROM modbm_core.schema_migrations ORDER BY filename;", capture=True)
    if not raw:
        return set()
    return set(raw.strip().splitlines())


def get_pending(applied: set[str]) -> list[str]:
    """Return ordered list of migration files not yet applied."""
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    all_files = sorted(glob.glob(pattern))
    pending = []
    for filepath in all_files:
        basename = os.path.basename(filepath)
        if basename not in applied:
            pending.append(filepath)
    return pending


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    status_only = "--status" in sys.argv

    ensure_tracking_table()
    applied = get_applied()
    pending = get_pending(applied)

    if status_only:
        pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
        all_files = sorted(glob.glob(pattern))
        print(f"{'Status':<10} {'Migration'}")
        print(f"{'------':<10} {'---------'}")
        for filepath in all_files:
            basename = os.path.basename(filepath)
            marker = "applied" if basename in applied else "PENDING"
            print(f"{marker:<10} {basename}")
        print(f"\n{len(applied)} applied, {len(pending)} pending")
        return

    if not pending:
        print("All migrations are up to date.")
        return

    print(f"{len(pending)} pending migration(s):\n")
    for filepath in pending:
        basename = os.path.basename(filepath)
        if dry_run:
            print(f"  [DRY RUN] Would apply: {basename}")
        else:
            print(f"  Applying: {basename} ...", end=" ", flush=True)
            psql_file(filepath)
            psql(f"INSERT INTO modbm_core.schema_migrations (filename) VALUES ('{basename}');")
            print("OK")

    if dry_run:
        print("\nDry run complete — no changes made.")
    else:
        print(f"\nDone. {len(pending)} migration(s) applied.")


if __name__ == "__main__":
    main()
