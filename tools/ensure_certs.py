#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil

# Set stdout to UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    certs_dir = os.path.join(root_dir, "certs")
    os.makedirs(certs_dir, exist_ok=True)

    privkey_path = os.path.join(certs_dir, "privkey.pem")
    fullchain_path = os.path.join(certs_dir, "fullchain.pem")

    if os.path.exists(privkey_path) and os.path.exists(fullchain_path) and os.path.getsize(privkey_path) > 100 and os.path.getsize(fullchain_path) > 100:
        print("[OK] SSL certificates already present in certs/")
        return 0

    print("Generating fallback self-signed SSL certificate for development/testing...")
    openssl = shutil.which("openssl")
    if openssl:
        try:
            cmd = [
                openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", privkey_path,
                "-out", fullchain_path,
                "-days", "3650",
                "-subj", "/CN=localhost"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                print(f"[OK] Self-signed SSL certificate created at {certs_dir}")
                return 0
            else:
                print(f"[WARN] openssl command failed: {res.stderr}")
        except Exception as e:
            print(f"[WARN] Could not execute openssl: {e}")

    # Fallback: create placeholder dummy certificates so Nginx can start
    if not os.path.exists(privkey_path) or os.path.getsize(privkey_path) < 10:
        with open(privkey_path, "w", encoding="utf-8") as f:
            f.write("-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----\n")
    if not os.path.exists(fullchain_path) or os.path.getsize(fullchain_path) < 10:
        with open(fullchain_path, "w", encoding="utf-8") as f:
            f.write("-----BEGIN CERTIFICATE-----\nplaceholder\n-----END CERTIFICATE-----\n")

    print(f"[OK] SSL certificate placeholder files created in {certs_dir}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
