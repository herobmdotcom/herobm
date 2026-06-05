import os
import sys
import subprocess
import glob
from dotenv import load_dotenv

load_dotenv()

CONTAINER = os.environ.get("POSTGRES_CONTAINER", "postgres-custom")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_NAME = os.environ.get("POSTGRES_DB", "herobm")

def psql(sql: str, capture: bool = False) -> str | None:
    cmd = [
        "podman", "exec", "-i", CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME,
        "-t", "-A",
        "-c", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print(f"ERROR: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    if capture:
        return result.stdout.strip()
    return None

def main():
    print(f"Syncing tracking table for database: {DB_NAME}")
    MIGRATIONS_DIR = os.path.join("apps", "api", "migrations")
    
    # get applied
    raw = psql("SELECT filename FROM modbm_core.schema_migrations ORDER BY filename;", capture=True)
    applied = set(raw.strip().splitlines()) if raw else set()
    
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    all_files = sorted(glob.glob(pattern))
    
    count = 0
    for filepath in all_files:
        basename = os.path.basename(filepath)
        if basename not in applied:
            print(f"Marking {basename} as applied...")
            psql(f"INSERT INTO modbm_core.schema_migrations (filename) VALUES ('{basename}');")
            count += 1
            
    print(f"Done. Synced {count} migrations.")

if __name__ == "__main__":
    main()
