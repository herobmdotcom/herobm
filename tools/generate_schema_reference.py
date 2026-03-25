"""
generate_schema_reference.py

Introspects the live Postgres `modbm_core` schema and produces an agent-friendly
docs/technical/schema_reference.md documenting every table, column, constraint,
and FK relationship.

Run via `make schema-ref`.

Usage:
    python tools/generate_schema_reference.py
"""
import os
import subprocess
import json
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_FILE = PROJECT_ROOT / "docs" / "technical" / "schema_reference.md"

SCHEMA = "modbm_core"
CONTAINER = "postgres-custom"


def load_env() -> dict:
    env_file = PROJECT_ROOT / ".env"
    env = os.environ.copy()
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    return env


def psql(query: str, env: dict) -> str:
    user = env.get("POSTGRES_USER", "postgres")
    db = env.get("POSTGRES_DB", "custom_app")
    result = subprocess.run(
        ["podman", "exec", "-i", CONTAINER, "psql", "-U", user, "-d", db,
         "-t", "-A", "-c", query],
        capture_output=True, text=True, timeout=15, env=env,
    )
    if result.returncode != 0:
        print(f"  SQL error: {result.stderr.strip()}")
        return ""
    return result.stdout.strip()


def psql_json(query: str, env: dict) -> list:
    """Run a query that returns JSON rows."""
    raw = psql(query, env)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


# ---------------------------------------------------------------------------
# Introspect schema
# ---------------------------------------------------------------------------
def get_tables(env: dict) -> list[dict]:
    """Get all tables with row counts."""
    query = f"""
    SELECT json_agg(t ORDER BY table_name) FROM (
        SELECT
            c.table_name,
            (SELECT n_live_tup FROM pg_stat_user_tables
             WHERE schemaname = '{SCHEMA}' AND relname = c.table_name) AS row_count
        FROM information_schema.tables c
        WHERE c.table_schema = '{SCHEMA}' AND c.table_type = 'BASE TABLE'
    ) t;
    """
    return psql_json(query, env) or []


def get_columns(env: dict) -> list[dict]:
    """Get all columns for all tables."""
    query = f"""
    SELECT json_agg(t ORDER BY table_name, ordinal_position) FROM (
        SELECT
            table_name,
            column_name,
            ordinal_position,
            data_type,
            udt_name,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = '{SCHEMA}'
    ) t;
    """
    return psql_json(query, env) or []


def get_constraints(env: dict) -> list[dict]:
    """Get all PK, FK, UNIQUE constraints."""
    query = f"""
    SELECT json_agg(t ORDER BY table_name, constraint_type, constraint_name) FROM (
        SELECT
            tc.table_name,
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_schema AS ref_schema,
            ccu.table_name AS ref_table,
            ccu.column_name AS ref_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = '{SCHEMA}'
            AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
    ) t;
    """
    return psql_json(query, env) or []


# ---------------------------------------------------------------------------
# Render markdown
# ---------------------------------------------------------------------------
def render(tables: list, columns: list, constraints: list) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Organize data
    col_map: dict[str, list] = {}
    for c in columns:
        col_map.setdefault(c["table_name"], []).append(c)

    con_map: dict[str, list] = {}
    for c in constraints:
        con_map.setdefault(c["table_name"], []).append(c)

    lines = [
        "# Schema Reference — `modbm_core`",
        "",
        f"> Auto-generated from live Postgres introspection. Last generated: {now}",
        "> Regenerate with: `make schema-ref`",
        "",
        f"**Postgres schema:** `{SCHEMA}`",
        "",
        "All tables are managed by Drizzle ORM with UUID primary keys and enforced FK constraints.",
        "",
    ]

    # Table of contents
    lines.append("## Tables")
    lines.append("")
    lines.append("| Table | Rows | PK | Description |")
    lines.append("|-------|------|----|-------------|")

    for t in tables:
        name = t["table_name"]
        rows = t.get("row_count")
        row_str = f"{rows:,}" if rows is not None else "—"

        # Find PK column
        pk_cols = [c["column_name"] for c in con_map.get(name, [])
                   if c["constraint_type"] == "PRIMARY KEY"]
        pk_str = ", ".join(f"`{c}`" for c in sorted(set(pk_cols))) if pk_cols else "—"

        lines.append(f"| [`{name}`](#{name}) | {row_str} | {pk_str} | |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # FK relationship map
    fk_entries = []
    for c in constraints:
        if c["constraint_type"] == "FOREIGN KEY":
            fk_entries.append(c)

    if fk_entries:
        lines.append("## Foreign Key Relationships")
        lines.append("")
        lines.append("| From Table | Column | → To Table | Column |")
        lines.append("|-----------|--------|-----------|--------|")
        seen = set()
        for fk in fk_entries:
            key = (fk["table_name"], fk["column_name"], fk["ref_table"], fk["ref_column"])
            if key not in seen:
                seen.add(key)
                lines.append(f"| `{fk['table_name']}` | `{fk['column_name']}` | `{fk['ref_table']}` | `{fk['ref_column']}` |")
        lines.append("")
        lines.append("---")
        lines.append("")

    # Lineage DAG
    lines.append("## Lineage")
    lines.append("")
    lines.append("```mermaid")
    lines.append("graph LR")

    for t in tables:
        name = t["table_name"]
        lines.append(f'    {name}["{name}"]')

    seen_edges = set()
    for fk in fk_entries:
        edge = (fk["ref_table"], fk["table_name"])
        if edge not in seen_edges:
            seen_edges.add(edge)
            lines.append(f"    {fk['ref_table']} --> {fk['table_name']}")

    lines.append("```")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Per-table detail
    for t in tables:
        name = t["table_name"]
        rows = t.get("row_count")
        row_str = f" ({rows:,} rows)" if rows is not None else ""

        lines.append(f"### `{SCHEMA}.{name}`{row_str}")
        lines.append("")

        # Column table
        table_cols = col_map.get(name, [])
        table_cons = con_map.get(name, [])

        # Build constraint annotations per column
        col_annotations: dict[str, list] = {}
        for c in table_cons:
            col = c["column_name"]
            if c["constraint_type"] == "PRIMARY KEY":
                col_annotations.setdefault(col, []).append("🔑 PK")
            elif c["constraint_type"] == "FOREIGN KEY":
                col_annotations.setdefault(col, []).append(
                    f"FK → {c['ref_table']}.{c['ref_column']}")
            elif c["constraint_type"] == "UNIQUE":
                col_annotations.setdefault(col, []).append("UNIQUE")

        lines.append("| # | Column | Type | Nullable | Default | Constraints |")
        lines.append("|---|--------|------|----------|---------|------------|")

        for i, col in enumerate(table_cols, 1):
            cname = col["column_name"]
            dtype = col.get("udt_name", col.get("data_type", ""))
            nullable = "✓" if col["is_nullable"] == "YES" else ""
            default = col.get("column_default", "") or ""
            # Truncate long defaults
            if default and len(default) > 40:
                default = default[:37] + "..."
            annotations = ", ".join(col_annotations.get(cname, []))

            lines.append(f"| {i} | `{cname}` | `{dtype}` | {nullable} | {default} | {annotations} |")

        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    env = load_env()

    print("Introspecting modbm_core schema from Postgres...")

    print("  Fetching tables...")
    tables = get_tables(env)
    if not tables:
        print("ERROR: No tables found. Is the database running?")
        return
    print(f"  Found {len(tables)} tables")

    print("  Fetching columns...")
    columns = get_columns(env)
    print(f"  Found {len(columns)} columns")

    print("  Fetching constraints...")
    constraints = get_constraints(env)
    print(f"  Found {len(constraints)} constraint entries")

    md = render(tables, columns, constraints)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"Written {len(md)} bytes to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
