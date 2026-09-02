"""
generate_schema_reference.py

Generates the Database Schema Reference for both:
1. Help Documentation: docs/user/database_schema.md
2. Technical Documentation: docs/technical/schema_reference.md

Usage:
    python tools/generate_schema_reference.py
"""
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
TS_SCRIPT = SCRIPT_DIR / "generate_schema_docs.ts"


def main():
    npx = "npx.cmd" if os.name == "nt" else "npx"
    cmd = [npx, "tsx", str(TS_SCRIPT)]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
