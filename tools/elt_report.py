import sys
import os
import json
import subprocess
import argparse
from datetime import datetime

def load_env(profile=None):
    env_file = f".env.{profile}" if profile else ".env"
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', env_file))
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

# To import test_data_counts we need to add infra/tests to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'infra', 'tests')))
try:
    import test_data_counts
except ImportError:
    test_data_counts = None

def get_db_metrics(source):
    # Read pipeline metrics from raw_{source}._pipeline_metrics
    sql = f"SELECT run_ts, duration_s, table_count, status, error_msg FROM raw_{source}._pipeline_metrics ORDER BY run_id DESC LIMIT 1;"
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get("POSTGRES_HOST", "postgres-custom"),
            port=os.environ.get("POSTGRES_PORT", "5432"),
            user=os.environ.get("POSTGRES_USER", "postgres"),
            password=os.environ.get("POSTGRES_PASSWORD", "postgres"),
            dbname=os.environ.get("POSTGRES_DB", "herobm")
        )
        cur = conn.cursor()
        cur.execute(sql)
        row = cur.fetchone()
        conn.close()
        if row:
            return {
                "ts": str(row[0]),
                "duration": str(row[1]),
                "tables": str(row[2]),
                "status": str(row[3]),
                "error": str(row[4]) if row[4] else ""
            }
    except Exception as e:
        print(f"Failed to fetch db metrics via psycopg2: {e}")
    return None

def get_dbt_results(source):
    path = os.path.join(os.path.dirname(__file__), '..', 'pipelines', f'{source}_transform', 'target', 'run_results.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    passed = 0
    errors = 0
    warnings = 0
    for res in data.get('results', []):
        if res.get('status') == 'success' or res.get('status') == 'pass':
            passed += 1
        elif res.get('status') == 'error' or res.get('status') == 'fail':
            errors += 1
        elif res.get('status') == 'warn':
            warnings += 1
            
    return {"passed": passed, "errors": errors, "warnings": warnings, "total": len(data.get('results', []))}


def main():
    parser = argparse.ArgumentParser(description="ELT Pipeline Summary Report")
    parser.add_argument("--profile", type=str, help="Environment profile to use (e.g. volzsg)", default=None)
    parser.add_argument("--source", type=str, required=True, help="Data source pipeline (e.g. abm, odoo)")
    args = parser.parse_args()

    # Load environment variables for the specified profile before anything else
    load_env(args.profile)

    print("\n" + "="*70)
    print(f" ELT PIPELINE SUMMARY REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    metrics = get_db_metrics(args.source)
    if metrics:
        print("\n[ EXTRACTION PHASE ]")
        print(f"  Status    : {metrics['status']}")
        print(f"  Tables    : {metrics['tables']} synced")
        print(f"  Duration  : {float(metrics['duration']):.1f}s")
        if metrics['error']:
            print(f"  Error     : {metrics['error']}")
    else:
        print("\n[ EXTRACTION PHASE ]")
        print("  Status    : Unknown / No metrics found in DB.")
        
    dbt_res = get_dbt_results(args.source)
    if dbt_res:
        print("\n[ TRANSFORMATION PHASE (DBT) ]")
        print(f"  Models Built : {dbt_res['passed']} / {dbt_res['total']}")
        print(f"  Warnings     : {dbt_res['warnings']}")
        print(f"  Errors       : {dbt_res['errors']}")
        if dbt_res['errors'] > 0:
            print("  [!] Please check dbt logs for failure details.")
    else:
        print("\n[ TRANSFORMATION PHASE (DBT) ]")
        print("  Status    : Unknown / No run_results.json found.")
        
    print("\n[ DATA VERIFICATION ]")
    if test_data_counts:
        # We temporarily hijack sys.stdout to capture test output or just run it directly.
        # test_data_counts.main() directly prints to stdout. Let's let it print!
        print("  Checking alignment between Staging and Core DB:")
        # avoid sys.exit(1) on failure, since we just want a report.
        try:
            test_data_counts.main()
        except SystemExit as e:
            if e.code != 0:
                print("\n  [!] Discrepancies detected between staging and final tables.")
    else:
        print("  test_data_counts module not found.")
        
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
