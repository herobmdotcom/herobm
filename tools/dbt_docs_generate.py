"""
Run dbt docs generate with env vars loaded from .env.

Usage: python tools/dbt_docs_generate.py
"""
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
source = os.environ.get("SOURCE")
if not source:
    print("Error: SOURCE environment variable is required (e.g. SOURCE=abm)")
    sys.exit(1)
DBT_DIR = PROJECT_ROOT / "pipelines" / f"{source}_transform"
if os.name == "nt":
    DBT_EXE = PROJECT_ROOT / ".venv" / "Scripts" / "dbt"
else:
    DBT_EXE = PROJECT_ROOT / ".venv" / "bin" / "dbt"
DBT_EXE = os.environ.get("DBT", str(DBT_EXE))

# Load .env
if ENV_FILE.exists():
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ[key.strip()] = value.strip()

result = subprocess.run(
    [str(DBT_EXE), "docs", "generate", "--profiles-dir", "."],
    cwd=str(DBT_DIR),
    env=os.environ,
)
sys.exit(result.returncode)
