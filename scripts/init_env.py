#!/usr/bin/env python3
import os
import sys
import shutil
import argparse
import secrets
import string

def generate_password(length=20):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def prompt(text, default=""):
    val = input(f"{text} [{default}]: ").strip()
    return val if val else default

def main():
    parser = argparse.ArgumentParser(description="HeroBM Platform Environment Initializer")
    parser.add_argument("-p", "--profile", help="Target environment profile (e.g., staging)")
    args = parser.parse_args()

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root_dir)

    active_profile = args.profile
    if not active_profile and os.path.exists(".active_profile"):
        with open(".active_profile", "r") as f:
            active_profile = f.read().strip()

    env_file_name = f".env.{active_profile}" if active_profile else ".env"
    env_file_path = os.path.join(root_dir, env_file_name)
    example_file_path = os.path.join(root_dir, ".env.example")

    if active_profile:
        print(f"\033[35mTargeting Environment Profile: {active_profile}\033[0m")

    if os.path.exists(env_file_path):
        print(f"\033[33m{env_file_name} already exists at {env_file_path}\033[0m")
        overwrite = input("Overwrite? (y/N): ").strip().lower()
        if overwrite != 'y':
            print("\033[31mAborted.\033[0m")
            sys.exit(0)

    if not os.path.exists(example_file_path):
        print(f"\033[31mERROR: .env.example not found at {example_file_path}\033[0m")
        sys.exit(1)

    with open(example_file_path, "r", encoding="utf-8") as f:
        content = f.read()

    print("\n\033[36m=== PostgreSQL Connection ===\033[0m")
    print("Press Enter to accept defaults, or supply details for an existing external Postgres server.")

    pg_host = prompt("POSTGRES_HOST", "localhost")
    content = content.replace("POSTGRES_HOST=localhost", f"POSTGRES_HOST={pg_host}")

    pg_port = prompt("POSTGRES_PORT", "5432")
    content = content.replace("POSTGRES_PORT=5432", f"POSTGRES_PORT={pg_port}")

    pg_user = prompt("POSTGRES_USER", "postgres")
    content = content.replace("POSTGRES_USER=postgres", f"POSTGRES_USER={pg_user}")

    print("\n\033[36m=== Regional Settings ===\033[0m")
    home_currency = prompt("HOME_CURRENCY (ISO Code)", "AUD")
    content = content.replace("HOME_CURRENCY=AUD", f"HOME_CURRENCY={home_currency}")

    pg_pass = prompt("POSTGRES_PASSWORD", "auto-generate secure sequence")
    if pg_pass != "auto-generate secure sequence":
        content = content.replace("POSTGRES_PASSWORD=<REDACTED>", f"POSTGRES_PASSWORD={pg_pass}")
    else:
        password = generate_password(20)
        content = content.replace("POSTGRES_PASSWORD=<REDACTED>", f"POSTGRES_PASSWORD={password}")
        print("  Generated: POSTGRES_PASSWORD")

    generated_vars = [
        "REDIS_PASSWORD",
        "GRAFANA_PASSWORD",
        "DEV_ADMIN_PASSWORD",
        "DEV_VIEWER_PASSWORD",
        "DEV_SALES_PASSWORD",
        "DEV_WAREHOUSE_PASSWORD",
        "DEV_PROCUREMENT_PASSWORD",
        "DEV_FINANCE_PASSWORD"
    ]

    print("\n\033[36m=== Generating remaining local secrets ===\033[0m")
    for var in generated_vars:
        if f"{var}=<REDACTED>" in content:
            content = content.replace(f"{var}=<REDACTED>", f"{var}={generate_password(20)}")
            print(f"  Generated: {var}")

    if "JWT_SECRET=<REDACTED>" in content:
        content = content.replace("JWT_SECRET=<REDACTED>", f"JWT_SECRET={generate_password(32)}")
        print("  Generated: JWT_SECRET")

    if active_profile:
        postgres_db = f"modbm_{active_profile}"
        content = content.replace("POSTGRES_DB=custom_app", f"POSTGRES_DB={postgres_db}")
        print(f"\n\033[32m=== Auto-Configured ===\n  POSTGRES_DB={postgres_db}\033[0m")

    typst_path = shutil.which("typst")
    if typst_path:
        # Avoid backslash issues on Windows
        typst_path_clean = typst_path.replace("\\", "\\\\") if os.name == 'nt' else typst_path
        content = content.replace("TYPST_BINARY_PATH=typst", f"TYPST_BINARY_PATH={typst_path_clean}")
        print(f"\n\033[32mDetected Typst at: {typst_path}\033[0m")

    with open(env_file_path, "w", encoding="utf-8", newline='\n') as f:
        f.write(content)

    print(f"\n\033[32m=== {env_file_name} created at {env_file_path} ===\033[0m")
    print("Review it and fill in any remaining <REDACTED> values.\n")

if __name__ == "__main__":
    main()
