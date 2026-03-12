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
DBT_DIR = PROJECT_ROOT / "pipelines" / "abm_transform"
DBT_EXE = PROJECT_ROOT / ".venv" / "Scripts" / "dbt"

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
