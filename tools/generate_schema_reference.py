"""
generate_schema_reference.py

Reads dbt's manifest.json and catalog.json to produce an agent-friendly
schema_reference.md in docs/. Only documents the public_marts schema —
staging is internal and should not be queried directly.

Run after `dbt docs generate` or via `make schema-ref`.

Usage:
    python tools/generate_schema_reference.py
"""
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DBT_TARGET = PROJECT_ROOT / "pipelines" / "abm_transform" / "target"
OUTPUT_FILE = PROJECT_ROOT / "docs" / "schema_reference.md"

MANIFEST_PATH = DBT_TARGET / "manifest.json"
CATALOG_PATH = DBT_TARGET / "catalog.json"

# ---------------------------------------------------------------------------
# Known data quirks (Improvement #4)
# These are documented per-model and rendered as callouts.
# ---------------------------------------------------------------------------
DATA_QUIRKS = {
    "mart_accounts": [
        "Status codes include legacy classifications `A1`, `A2`, `A28` beyond standard `A`/`S`/`H`.",
    ],
    "mart_products": [
        "Includes system pseudo-products (e.g., `Discount`, `GST`) that have zero stock "
        "and anomalous `last_in_unit_cost` values. These are not real inventory items.",
    ],
    "mart_inventory": [
        "`quantity_available` can be legitimately negative (oversold stock: `qty_on_hand - qty_customer_orders`).",
        "`value_on_hand` has 28 sub-cent rounding residuals (max magnitude $0.008) on "
        "zero-stock items — ERP moving-average artefact.",
        "`last_in_unit_cost` is negative for 3 pseudo-products (`Discount`, `GST`, one fitting) — "
        "side-effect of routing non-stock line items through the costing engine.",
    ],
    "mart_sales_order_lines": [
        "ABM models **discounts as negative line items** (`product_number = 'Discount'`). "
        "`price_per_unit`, `amount`, `tax`, and `total_amount` are intentionally negative on these rows. "
        "`not_negative` is intentionally **not** applied to financial columns.",
        "`document_date` is cast from `text` → `timestamp with time zone` in the mart SQL.",
    ],
    "mart_bin_contents": [],
}


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Parse manifest
# ---------------------------------------------------------------------------
def parse_manifest(manifest: dict) -> dict:
    """Extract models, their columns, constraints, and tests."""
    models = {}

    for key, node in manifest["nodes"].items():
        if node["resource_type"] != "model":
            continue
        # Only document marts (public_marts schema)
        if node.get("schema", "") != "public_marts":
            continue

        cols = []
        for col_name, col in node.get("columns", {}).items():
            constraints = []
            for c in col.get("constraints", []):
                ctype = c.get("type", "")
                detail = ""
                if ctype == "foreign_key" and c.get("to"):
                    to_raw = c["to"]
                    to_model = to_raw.replace("ref('", "").replace("')", "")
                    if '"' in to_model:
                        to_model = to_model.split('"')[-2]
                    to_cols = c.get("to_columns", [])
                    detail = f" → {to_model}({', '.join(to_cols)})"
                constraints.append(f"{ctype}{detail}")

            cols.append({
                "name": col.get("name", col_name),
                "data_type": col.get("data_type", ""),
                "description": col.get("description", ""),
                "constraints": constraints,
            })

        models[node["name"]] = {
            "unique_id": key,
            "schema": node.get("schema", ""),
            "description": node.get("description", "").strip(),
            "materialized": node.get("config", {}).get("materialized", "view"),
            "contract_enforced": node.get("contract", {}).get("enforced", False),
            "columns": cols,
            "depends_on_models": [
                d.split(".")[-1]
                for d in node.get("depends_on", {}).get("nodes", [])
                if d.startswith("model.")
            ],
            "depends_on_sources": [
                d.split(".")[-1]
                for d in node.get("depends_on", {}).get("nodes", [])
                if d.startswith("source.")
            ],
        }

    # Parse tests -> map to model+column
    test_map = defaultdict(list)
    for key, node in manifest["nodes"].items():
        if node["resource_type"] != "test":
            continue
        test_meta = node.get("test_metadata")
        if test_meta:
            test_name = test_meta.get("name", node["name"])
            kwargs = test_meta.get("kwargs", {})
            model_ref = kwargs.get("model", "")
            col_ref = kwargs.get("column_name", "")
            if model_ref and "ref('" in model_ref:
                m = re.search(r"ref\('([^']+)'\)", model_ref)
                model_name = m.group(1) if m else ""
                severity = node.get("config", {}).get("severity", "error")
                if test_name == "accepted_values":
                    vals = kwargs.get("values", [])
                    desc = f"accepted_values({', '.join(repr(v) for v in vals)})"
                elif test_name == "not_null" and severity == "warn":
                    desc = "not_null (warn)"
                elif test_name == "not_negative" and severity == "warn":
                    desc = "not_negative (warn)"
                else:
                    desc = test_name
                test_map[(model_name, col_ref)].append(desc)
        else:
            for dep in node.get("depends_on", {}).get("nodes", []):
                if dep.startswith("model."):
                    model_name = dep.split(".")[-1]
                    test_map[(model_name, "")].append(node["name"])

    # Attach tests to models
    for model_name, model in models.items():
        model["model_tests"] = test_map.get((model_name, ""), [])
        for col in model["columns"]:
            col["tests"] = test_map.get((model_name, col["name"]), [])

    return models


# ---------------------------------------------------------------------------
# Parse catalog (row counts, actual types)
# ---------------------------------------------------------------------------
def parse_catalog(catalog: dict) -> dict:
    """Extract actual Postgres metadata per model."""
    cat_info = {}
    for key, node in catalog.get("nodes", {}).items():
        meta = node.get("metadata", {})
        name = meta.get("name", "")
        stats = node.get("stats", {})
        row_count = None
        if "row_count" in stats:
            try:
                row_count = int(float(stats["row_count"].get("value", 0)))
            except (ValueError, TypeError):
                pass
        cat_info[name] = {
            "table_type": meta.get("type", ""),
            "row_count": row_count,
            "columns": {
                col_name: {
                    "type": col.get("type", ""),
                    "index": col.get("index", 0),
                }
                for col_name, col in node.get("columns", {}).items()
            },
        }
    for key, node in catalog.get("sources", {}).items():
        meta = node.get("metadata", {})
        name = meta.get("name", "")
        cat_info[name] = {
            "table_type": meta.get("type", ""),
            "row_count": None,
            "columns": {
                col_name: {
                    "type": col.get("type", ""),
                    "index": col.get("index", 0),
                }
                for col_name, col in node.get("columns", {}).items()
            },
        }
    return cat_info


# ---------------------------------------------------------------------------
# Get row counts from Postgres (Improvement #2)
# ---------------------------------------------------------------------------
def get_row_counts() -> dict:
    """Query Postgres for current row counts in public_marts."""
    env_file = PROJECT_ROOT / ".env"
    env = os.environ.copy()
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()

    user = env.get("POSTGRES_USER", "postgres")
    db = env.get("POSTGRES_DB", "custom_app")

    # Get table list first
    try:
        result = subprocess.run(
            ["docker", "exec", "postgres-custom", "psql", "-U", user, "-d", db,
             "-t", "-A", "-c",
             "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public_marts' ORDER BY 1;"],
            capture_output=True, text=True, timeout=10, env=env,
        )
        tables = [t.strip() for t in result.stdout.strip().splitlines() if t.strip()]
    except Exception:
        return {}

    counts = {}
    for table in tables:
        try:
            result = subprocess.run(
                ["docker", "exec", "postgres-custom", "psql", "-U", user, "-d", db,
                 "-t", "-A", "-c", f"SELECT count(*) FROM public_marts.{table};"],
                capture_output=True, text=True, timeout=10, env=env,
            )
            val = result.stdout.strip()
            if val:
                counts[table] = int(val)
        except Exception:
            pass
    return counts


# ---------------------------------------------------------------------------
# Get source freshness (Improvement #3)
# ---------------------------------------------------------------------------
def get_source_freshness() -> dict:
    """Query the latest _dlt_load_id from a representative source table."""
    env_file = PROJECT_ROOT / ".env"
    env = os.environ.copy()
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()

    user = env.get("POSTGRES_USER", "postgres")
    db = env.get("POSTGRES_DB", "custom_app")

    query = (
        "SELECT to_timestamp(max(_dlt_load_id::double precision)) AS last_load "
        "FROM raw_abm.customers;"
    )
    try:
        result = subprocess.run(
            ["docker", "exec", "postgres-custom", "psql", "-U", user, "-d", db, "-t", "-A", "-c", query],
            capture_output=True, text=True, timeout=15,
        )
        ts = result.stdout.strip()
        if ts:
            return {"last_load": ts, "status": "ok"}
    except Exception:
        pass
    return {"last_load": "unknown", "status": "unavailable"}


# ---------------------------------------------------------------------------
# Render markdown
# ---------------------------------------------------------------------------
def render_markdown(models: dict, catalog: dict, row_counts: dict, freshness: dict) -> str:
    lines = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # --- Header ---
    lines.append("# Schema Reference")
    lines.append("")
    lines.append("> Auto-generated from dbt metadata. Only documents the **mart layer**.")
    lines.append(f"> Last generated: {now}")
    lines.append("> Regenerate with: `make schema-ref`")
    lines.append("")
    lines.append("**Postgres schema:** `public_marts`")
    lines.append("")
    lines.append("All mart tables use **dbt Model Contracts** (🔒) with enforced data types and database-level constraints.")
    lines.append("")

    # --- Source freshness (Improvement #3) ---
    lines.append("**Source freshness:**")
    if freshness.get("status") == "ok":
        lines.append(f" Last raw data load: `{freshness['last_load']}`")
        lines.append(f" Freshness checks: warn after 36h, error after 72h")
    else:
        lines.append(f" Status: {freshness.get('status', 'unknown')}")
    lines.append("")

    sorted_models = sorted(models.items())

    # --- Table of contents with row counts (Improvements #1 & #2) ---
    lines.append("## Models")
    lines.append("")
    lines.append("| Model | Rows | Description |")
    lines.append("|-------|------|-------------|")
    for name, model in sorted_models:
        count = row_counts.get(name)
        count_str = f"{count:,}" if count is not None else "—"
        desc = model["description"].split(".")[0] if model["description"] else ""
        lines.append(f"| [`{name}`](#{name}) | {count_str} | {desc} |")
    lines.append("")

    lines.append("---")
    lines.append("")

    # --- Lineage DAG (Improvement #5) ---
    lines.append("## Lineage")
    lines.append("")
    lines.append("```mermaid")
    lines.append("graph LR")

    # Collect all staging models referenced
    all_stg = set()
    for name, model in sorted_models:
        for dep in model["depends_on_models"]:
            if dep.startswith("stg_"):
                all_stg.add(dep)

    # Render staging nodes
    for stg in sorted(all_stg):
        lines.append(f'    {stg}["{stg}"]')

    # Render mart nodes with different style
    for name, _ in sorted_models:
        lines.append(f'    {name}["{name}"]:::mart')

    # Render edges
    for name, model in sorted_models:
        for dep in model["depends_on_models"]:
            lines.append(f"    {dep} --> {name}")

    lines.append("    classDef mart fill:#2d6a4f,stroke:#1b4332,color:#fff")
    lines.append("```")
    lines.append("")

    lines.append("---")
    lines.append("")

    # --- Join reference ---
    lines.append("## Join Reference")
    lines.append("")
    lines.append("| From | Join column | → To | Key column |")
    lines.append("|------|------------|------|------------|")

    for name, model in sorted_models:
        for col in model["columns"]:
            for c in col.get("constraints", []):
                if c.startswith("foreign_key"):
                    parts = c.split(" → ")
                    if len(parts) == 2:
                        target = parts[1]
                        to_table = target.split("(")[0]
                        to_col = target.split("(")[1].rstrip(")")
                        lines.append(f"| `{name}` | `{col['name']}` | `{to_table}` | `{to_col}` |")

    lines.append("")
    lines.append("---")
    lines.append("")

    # --- Model detail sections ---
    for name, model in sorted_models:
        count = row_counts.get(name)
        count_str = f" ({count:,} rows)" if count is not None else ""

        lines.append(f"### `public_marts.{name}`{count_str}")
        lines.append("")

        if model["description"]:
            lines.append(f"{model['description']}")
            lines.append("")

        # Dependencies
        if model["depends_on_models"]:
            mart_deps = [d for d in model["depends_on_models"] if d.startswith("mart_")]
            stg_deps = [d for d in model["depends_on_models"] if d.startswith("stg_")]
            if mart_deps:
                lines.append(f"**Mart dependencies:** {', '.join(f'`{d}`' for d in mart_deps)}")
            if stg_deps:
                lines.append(f"**Staging sources:** {', '.join(f'`{d}`' for d in stg_deps)}")
            lines.append("")

        # Model-level tests
        if model.get("model_tests"):
            tests = ", ".join(f"`{t}`" for t in model["model_tests"])
            lines.append(f"**Model tests:** {tests}")
            lines.append("")

        # Columns table
        lines.append("| # | Column | Type | Constraints | Tests | Description |")
        lines.append("|---|--------|------|-------------|-------|-------------|")

        for i, col in enumerate(model["columns"], 1):
            cname = col["name"]
            dtype = col.get("data_type", "")

            if not dtype and name in catalog:
                cat_col = catalog[name].get("columns", {}).get(cname, {})
                dtype = cat_col.get("type", "")

            constraints = ", ".join(col.get("constraints", []))
            tests = ", ".join(col.get("tests", []))
            desc = col.get("description", "").replace("|", "\\|")

            lines.append(f"| {i} | `{cname}` | `{dtype}` | {constraints} | {tests} | {desc} |")

        lines.append("")

        # Data quirks (Improvement #4)
        quirks = DATA_QUIRKS.get(name, [])
        if quirks:
            lines.append("> [!NOTE]")
            lines.append("> **Data quirks:**")
            for q in quirks:
                lines.append(f"> - {q}")
            lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not MANIFEST_PATH.exists():
        print(f"ERROR: {MANIFEST_PATH} not found. Run `make docs-generate` first.")
        return

    print(f"Reading {MANIFEST_PATH}...")
    manifest = load_json(MANIFEST_PATH)

    print(f"Reading {CATALOG_PATH}...")
    catalog_raw = load_json(CATALOG_PATH)

    models = parse_manifest(manifest)
    catalog = parse_catalog(catalog_raw)

    print(f"Found {len(models)} mart models")

    # Live data enrichment
    print("Querying row counts from Postgres...")
    row_counts = get_row_counts()
    if row_counts:
        print(f"  Got row counts for {len(row_counts)} tables")
    else:
        print("  WARNING: Could not query row counts (Postgres may be down)")

    print("Querying source freshness...")
    freshness = get_source_freshness()
    print(f"  Last load: {freshness.get('last_load', 'unknown')}")

    md = render_markdown(models, catalog, row_counts, freshness)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"Written {len(md)} bytes to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
