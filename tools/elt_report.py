import sys
import os
import json
import argparse
from datetime import datetime

def load_env(profile=None):
    if not profile:
        active_prof_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.active_profile'))
        if os.path.exists(active_prof_path):
            with open(active_prof_path, 'r', encoding='utf-8') as f:
                profile = f.read().strip()
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
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")

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
            host=os.environ.get("POSTGRES_HOST", "localhost"),
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
    target_dir = os.path.join(os.path.dirname(__file__), '..', 'pipelines', f'{source}_transform', 'target')
    manifest_path = os.path.join(target_dir, 'manifest.json')
    run_results_path = os.path.join(target_dir, 'run_results.json')
    
    total_models = 0
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            total_models = len([
                k for k, v in manifest.get('nodes', {}).items()
                if v.get('resource_type') == 'model' and v.get('config', {}).get('enabled', True)
            ])
        except Exception:
            pass

    if not os.path.exists(run_results_path):
        return None

    try:
        with open(run_results_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return None
    
    passed = 0
    errors = 0
    warnings = 0
    for res in data.get('results', []):
        if res.get('status') in ('success', 'pass'):
            passed += 1
        elif res.get('status') in ('error', 'fail'):
            errors += 1
        elif res.get('status') == 'warn':
            warnings += 1
            
    return {
        "passed": passed,
        "errors": errors,
        "warnings": warnings,
        "last_batch_total": len(data.get('results', [])),
        "project_total_models": total_models
    }

def main():
    parser = argparse.ArgumentParser(description="ELT Pipeline Summary Report")
    parser.add_argument("--profile", type=str, help="Environment profile to use (e.g. production)", default=None)
    parser.add_argument("--source", type=str, required=True, help="Data source pipeline (e.g. abm, odoo)")
    args = parser.parse_args()

    # Load environment variables for the specified profile before anything else
    load_env(args.profile)

    print("\n" + "="*70)
    print(f" ELT PIPELINE SUMMARY REPORT - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    metrics = get_db_metrics(args.source)
    if metrics:
        print("\n[ EXTRACTION PHASE (dlt) ]")
        print(f"  Status    : {metrics['status']}")
        print(f"  Tables    : {metrics['tables']} synced")
        print(f"  Duration  : {float(metrics['duration']):.1f}s")
        if metrics['error']:
            print(f"  Error     : {metrics['error']}")
    else:
        print("\n[ EXTRACTION PHASE (dlt) ]")
        print("  Status    : Unknown / No metrics found in DB.")
        
    dbt_res = get_dbt_results(args.source)
    if dbt_res:
        print("\n[ TRANSFORMATION & IMPORT PHASE (dbt) ]")
        if dbt_res['project_total_models'] > 0:
            print(f"  Total Models in Project : {dbt_res['project_total_models']}")
        print(f"  Last Run Status         : {'SUCCESS' if dbt_res['errors'] == 0 else 'FAILURE'}")
        if dbt_res['errors'] > 0:
            print(f"  Errors                  : {dbt_res['errors']}")
            print("  [!] Please check dbt logs for failure details.")
    else:
        print("\n[ TRANSFORMATION & IMPORT PHASE (dbt) ]")
        print("  Status    : Unknown / No run_results.json found.")
        
    if test_data_counts:
        try:
            test_data_counts.main()
        except SystemExit as e:
            if e.code != 0:
                print("\n  [!] Quality gate failure detected during data verification.")
    else:
        print("\n[ DATA VERIFICATION ]")
        print("  test_data_counts module not found.")

if __name__ == "__main__":
    main()
