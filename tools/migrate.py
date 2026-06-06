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
EXTENSIONS_FILE = os.path.join("apps", "api", "src", "drizzle", "extensions.sql")
CONTAINER = os.environ.get("POSTGRES_CONTAINER", "postgres-custom")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_NAME = os.environ.get("POSTGRES_DB", "herobm")


def psql(sql: str, capture: bool = False) -> str | None:
    """Execute SQL via docker exec psql."""
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-t", "-A",  # tuples-only, unaligned output
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if capture:
        return result.stdout.strip()
    return None


def psql_file(filepath: str, record_migration: str | None = None) -> bool:
    """Execute a SQL file via docker exec psql."""
    with open(filepath, "r", encoding="utf-8-sig") as f:
        sql = f.read()
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
    ]
    if record_migration:
        cmd.append("-1")  # wrap in a single transaction
        sql += f"\nCREATE TABLE IF NOT EXISTS modbm_core.schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());\n"
        sql += f"\nINSERT INTO modbm_core.schema_migrations (filename) VALUES ('{record_migration}');\n"

    # Pass known env vars as psql variables for migration seeding
    for env_key in [
        "ADMIN_PASSWORD", "DEV_SALES_PASSWORD",
        "DEV_WAREHOUSE_PASSWORD", "DEV_PROCUREMENT_PASSWORD",
    ]:
        val = os.environ.get(env_key, "")
        if val:
            cmd.extend(["-v", f"{env_key}={val}"])
    result = subprocess.run(cmd, input=sql, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"\nERROR applying migration:\n{result.stderr.strip()}", file=sys.stderr)
        return False
    if result.stdout.strip():
        print(f"  {result.stdout.strip()}")
    return True


def ensure_tracking_table() -> None:
    """Create the migration tracking table if it doesn't exist, provided the schema exists."""
    check = psql("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'modbm_core');", capture=True)
    if check and check.strip() == 't':
        psql("""
            CREATE TABLE IF NOT EXISTS modbm_core.schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)


def apply_extensions(dry_run: bool) -> None:
    """Always apply idempotent custom views, functions, and triggers."""
    if not os.path.exists(EXTENSIONS_FILE):
        return
    if dry_run:
        print(f"\n  [DRY RUN] Would apply extensions: {os.path.basename(EXTENSIONS_FILE)}")
    else:
        print(f"\n  Applying extensions: {os.path.basename(EXTENSIONS_FILE)} ...", end=" ", flush=True)
        psql_file(EXTENSIONS_FILE)
        print("OK")


def get_applied() -> set[str]:
    """Return set of already-applied migration filenames."""
    check = psql("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'modbm_core' AND table_name = 'schema_migrations');", capture=True)
    if not check or check.strip() != 't':
        return set()
        
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
    mark_all = "--mark-all-applied" in sys.argv

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

    if mark_all:
        if not pending:
            print("No pending migrations to mark as applied.")
            return
        print(f"Marking {len(pending)} migration(s) as applied without executing them:")
        for filepath in pending:
            basename = os.path.basename(filepath)
            print(f"  Marking: {basename} ...", end=" ", flush=True)
            psql(f"CREATE TABLE IF NOT EXISTS modbm_core.schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO modbm_core.schema_migrations (filename) VALUES ('{basename}');")
            print("OK")
        print("\nDone. Migration history synced.")
        return

    if not pending:
        print("All migrations are up to date.")
        apply_extensions(dry_run)
        return

    print(f"{len(pending)} pending migration(s):\n")
    for filepath in pending:
        basename = os.path.basename(filepath)
        if dry_run:
            print(f"  [DRY RUN] Would apply: {basename}")
        else:
            print(f"  Applying: {basename} ...", end=" ", flush=True)
            success = psql_file(filepath, record_migration=basename)
            if success:
                print("OK")
            else:
                if not sys.stdin.isatty():
                    print("Non-interactive terminal detected. Aborting.", file=sys.stderr)
                    sys.exit(1)
                
                try:
                    choice = input(f"Migration {basename} failed. Mark it as applied and continue to the next? (y/N): ").strip().lower()
                except EOFError:
                    choice = 'n'
                    
                if choice == 'y':
                    psql(f"CREATE TABLE IF NOT EXISTS modbm_core.schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO modbm_core.schema_migrations (filename) VALUES ('{basename}');")
                    print("  -> Marked as applied. Continuing...")
                else:
                    print("Aborting.")
                    sys.exit(1)

    if dry_run:
        print("\nDry run complete — no changes made.")
        apply_extensions(dry_run)
    else:
        print(f"\nDone. {len(pending)} migration(s) applied.")
        apply_extensions(dry_run)


if __name__ == "__main__":
    main()
