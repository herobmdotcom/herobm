"""
tools/preserve_currency.py
Preserves the active tenant base currency into .setup_currency before herobm_core is dropped during clean-db.
"""
import os
import subprocess
import sys

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_file = os.path.join(root_dir, ".setup_currency")

    # If .setup_currency already exists, keep it
    if os.path.exists(target_file):
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                val = f.read().strip().upper()
                if val and len(val) == 3:
                    print(f"  Existing setup currency preserved: {val}")
                    return
        except Exception:
            pass

    user = os.environ.get("POSTGRES_USER")
    if not user:
        env_file = os.path.join(root_dir, ".env")
        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("POSTGRES_USER="):
                            user = line.strip().split("=", 1)[1].strip("'\"")
                            break
            except Exception:
                pass
    if not user:
        return
    db = os.environ.get("POSTGRES_DB", "herobm")
    cmd = [
        "podman", "exec", "-i", "postgres-custom",
        "psql", "-U", user, "-d", db, "-t", "-A",
        "-c", "SELECT base_currency FROM herobm_core.gl_settings WHERE base_currency IS NOT NULL LIMIT 1;"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        currency = res.stdout.strip().upper()
        if currency and not currency.startswith("ERROR") and len(currency) == 3:
            with open(target_file, "w", encoding="utf-8") as f:
                f.write(f"{currency}\n")
            print(f"  Preserved tenant base currency before schema reset: {currency}")
    except Exception:
        # Ignore gracefully if table or container doesn't exist
        pass

if __name__ == "__main__":
    main()
