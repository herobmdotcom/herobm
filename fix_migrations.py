import os
import sys
import subprocess
import json

migrations_dir = r"C:\Users\Marcel\volz\modbm\modbm\apps\api\migrations"
db_url = "postgresql://postgres:Xk9mQv2Lp7wBnZ4Tj@localhost:5432/modbm_volzau"

renames = {
    "0020_state_constraints.sql": "0021_state_constraints.sql",
    "0021_add_invoice_receipts.sql": "0022_add_invoice_receipts.sql",
    "0022_rename_gst_to_tax.sql": "0023_rename_gst_to_tax.sql",
    "0023_split_product_tax_categories.sql": "0024_split_product_tax_categories.sql",
    "0024_add_backorder_modified_on.sql": "0025_add_backorder_modified_on.sql",
    "0024_require_tax_on_order_lines.sql": "0026_require_tax_on_order_lines.sql",
    "0025_update_po_state_check.sql": "0027_update_po_state_check.sql",
    "0026_add_performance_indices.sql": "0028_add_performance_indices.sql",
}

# 1. Update DB
for old_name, new_name in renames.items():
    sql = f"UPDATE modbm_core.schema_migrations SET filename = '{new_name}' WHERE filename = '{old_name}';"
    try:
        subprocess.run(["podman", "exec", "-i", "postgres-custom", "psql", "-U", "postgres", "-d", "modbm_volzau", "-c", sql], check=True)
    except Exception as e:
        print(f"Failed DB update: {e}")

# 2. Rename Files
for old_name, new_name in renames.items():
    old_path = os.path.join(migrations_dir, old_name)
    new_path = os.path.join(migrations_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)
        print(f"Renamed {old_name} -> {new_name}")

# 3. Rebuild Journal
journal_path = os.path.join(migrations_dir, "meta", "_journal.json")
if os.path.exists(journal_path):
    with open(journal_path, 'r') as f:
        journal = json.load(f)
    
    # Actually, the best way to rebuild the journal is to just list the files, sort them, and recreate the entries.
    files = sorted([f for f in os.listdir(migrations_dir) if f.endswith(".sql")])
    entries = []
    for idx, f in enumerate(files):
        tag = f[:-4] # remove .sql
        # preserve "when" if it existed, else use a fake one
        existing = next((e for e in journal.get("entries", []) if e.get("tag") == tag), None)
        # if not found, maybe match by idx?
        if not existing:
            existing = next((e for e in journal.get("entries", []) if e.get("idx") == idx), {})
        
        entries.append({
            "idx": idx,
            "version": "7",
            "when": existing.get("when", 1777371159679 + idx),
            "tag": tag,
            "breakpoints": True
        })
    journal["entries"] = entries
    with open(journal_path, 'w') as f:
        json.dump(journal, f, indent=2)
    print("Rebuilt journal")

# 4. Fix test script
test_script = r"C:\Users\Marcel\volz\modbm\modbm\infra\tests\test_drizzle_schema_sync.ps1"
with open(test_script, 'r') as f:
    content = f.read()

content = content.replace("npx drizzle-kit generate 2>&1", "npx drizzle-kit generate --name drift_check 2>&1")
with open(test_script, 'w') as f:
    f.write(content)
print("Patched test script")
