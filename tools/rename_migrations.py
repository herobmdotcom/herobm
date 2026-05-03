import os
import json
import subprocess
import sys

MIGRATIONS_DIR = os.path.join("apps", "api", "migrations")
META_DIR = os.path.join(MIGRATIONS_DIR, "meta")

mapping = {
    "0001_medical_wild_pack.sql": "0001_drop_erpnext_journal_id.sql",
    "0002_cynical_quicksilver.sql": "0002_add_context_slug_to_report_hook.sql",
    "0003_melodic_carnage.sql": "0003_drop_default_discount_percentage.sql",
    "0004_black_nextwave.sql": "0004_require_context_slug.sql",
    "0005_wonderful_misty_knight.sql": "0005_drop_gl_settings_defaults.sql",
    "0007_nosy_richard_fisk.sql": "0007_create_trading_terms.sql",
    "0008_gigantic_namora.sql": "0008_create_supplier_expiries.sql",
    "0010_ambiguous_captain_cross.sql": "0010_set_gl_accounts_currency_default.sql",
    "0011_charming_titanium_man.sql": "0011_add_receipt_filename_and_gst_category.sql",
    "0012_petite_mystique.sql": "0012_create_purchase_order_return_lines.sql",
    "0014_many_pyro.sql": "0014_create_system_events.sql",
    "0015_glamorous_nocturne.sql": "0015_create_product_default_bins.sql",
    "0016_cool_lily_hollister.sql": "0016_drop_is_primary_from_product_default_bins.sql",
    "0017_sloppy_vulcan.sql": "0017_add_is_primary_per_loc_to_product_default_bins.sql",
    "0018_quiet_moondragon.sql": "0018_drop_currency_defaults.sql",
    "0035_freezing_george_stacy.sql": "0035_create_macros.sql"
}

def psql(db_name: str, sql: str):
    cmd = [
        "podman", "exec", "-i", "postgres-custom",
        "psql", "-U", "postgres", "-d", db_name,
        "-t", "-A", "-c", sql,
    ]
    subprocess.run(cmd, check=True)

def rename_files():
    for old, new in mapping.items():
        # Rename .sql file
        old_sql = os.path.join(MIGRATIONS_DIR, old)
        new_sql = os.path.join(MIGRATIONS_DIR, new)
        if os.path.exists(old_sql):
            os.rename(old_sql, new_sql)
            print(f"Renamed: {old} -> {new}")
            
    # Update journal.json
    journal_path = os.path.join(META_DIR, "_journal.json")
    if os.path.exists(journal_path):
        with open(journal_path, "r", encoding="utf-8") as f:
            journal = json.load(f)
            
        changed = False
        for entry in journal.get("entries", []):
            old_name = entry.get("tag")
            if old_name:
                sql_name = old_name + ".sql"
                if sql_name in mapping:
                    new_tag = mapping[sql_name].replace(".sql", "")
                    entry["tag"] = new_tag
                    changed = True
                    
        if changed:
            with open(journal_path, "w", encoding="utf-8") as f:
                json.dump(journal, f, indent=2)
            print("Updated _journal.json")

    # Update DB
    dbs = ["modbm_volzsg", "modbm_volzau"]
    for db in dbs:
        print(f"Updating tracking table in {db}...")
        for old, new in mapping.items():
            sql = f"UPDATE modbm_core.schema_migrations SET filename = '{new}' WHERE filename = '{old}';"
            try:
                psql(db, sql)
            except Exception as e:
                print(f"Failed to update {old} to {new} in {db}: {e}")

if __name__ == "__main__":
    rename_files()
