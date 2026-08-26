import sys
import os
import json
import argparse
from datetime import datetime
import io

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
    return profile or "default"

# To import test_data_counts we need to add infra/tests to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'infra', 'tests')))
try:
    import test_data_counts
except ImportError:
    test_data_counts = None

def get_db_metrics(source):
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

def generate_markdown_report(profile, source, metrics, dbt_res, audit_stdout, report_time):
    report_md = f"""# ELT Reconciliation & Data Quality Summary Report

**Generated At**: `{report_time}`  
**Profile**: `{profile}`  
**Source System**: `{source.upper()}`  

---

## 1. Pipeline Execution Status

| Pipeline Phase | Status | Details | Duration |
| :--- | :--- | :--- | :--- |
| **Extraction (`dlt`)** | `{(metrics['status'] if metrics else 'UNKNOWN')}` | `{metrics['tables'] if metrics else 'N/A'} tables synced` | `{float(metrics['duration']):.1f}s` if metrics else 'N/A' |
| **Transformation (`dbt`)** | `{('SUCCESS' if dbt_res and dbt_res['errors'] == 0 else 'FAILURE') if dbt_res else 'UNKNOWN'}` | `{dbt_res['project_total_models'] if dbt_res else 'N/A'} models enabled` | N/A |

---

## 2. Data Verification & Quality Audit Log

```
{audit_stdout.strip()}
```

---

## 3. Subledger & General Ledger Reconciliation Guide

This section explains how each control account comparison is derived:

### Accounts Receivable (Trade Debtors)
* **Subledger Formula**: Sum of outstanding balances on open customer sales invoices minus credit notes and unallocated customer receipts.
* **Control Account**: Configured / dynamically resolved Trade Debtors control account.
* **Interpreting Drift**: A difference between subledger and GL typically arises from manual journal entries posted directly to the debtor control account in the source system without corresponding customer transactions, bad debt write-offs, or unallocated payments.

### Accounts Payable (Trade Creditors)
* **Subledger Formula**: Sum of outstanding balances on open supplier purchase invoices minus debit notes and unallocated supplier payments.
* **Control Account**: Configured / dynamically resolved Trade Creditors control account.
* **Interpreting Drift**: Variances typically indicate manual adjustments, year-end accruals, or payment clearing journals posted directly to the GL control account without linked supplier dockets.

### Goods Received Not Invoiced (GRNI Accrual)
* **Subledger Formula**: Valuation of goods received dockets with status `received` (awaiting purchase invoice match) multiplied by unit receipt cost.
* **Control Account**: Configured / dynamically resolved GRNI (Goods Received Not Invoiced) control account.
* **Interpreting Drift**: Subledger exceeds GL when historical goods receipt records remain open in the operational tables while corresponding invoices were entered independently or cleared via year-end journals.

### Perpetual Inventory (Stock on Hand)
* **Subledger Formula**: Sum of physical bin stock quantities multiplied by Weighted Average Cost (`weighted_average_cost`).
* **Control Account**: Configured / dynamically resolved Inventory asset control account.
* **Interpreting Drift**: Differences may stem from inventory revaluations, physical stocktake adjustments, or inventory write-down provisions maintained on separate sub-accounts in the GL.

---

## 4. Cutover & Reconciliation Guidelines

1. **Subledger Verification**: Review open customer/supplier balances against source system aged trial balance statements as of cutover date.
2. **Control Account Parity**: If subledger-to-GL drift exists in the source database, determine whether to maintain historical GL balances or post an opening cutover alignment journal against an Opening Suspense / Equity account.
3. **Operational Cutover**: Moving forward in HeroBM, new transactions enforce strict subledger-to-GL posting invariants with automatic real-time reconciliation.
4. **GRNI Roll-Forward**: Active operations match new goods receipts directly to purchase invoices, preventing historical unlinked dockets from affecting ongoing periods.
"""
    return report_md

def main():
    parser = argparse.ArgumentParser(description="ELT Pipeline Summary Report")
    parser.add_argument("--profile", type=str, help="Environment profile to use (e.g. production)", default=None)
    parser.add_argument("--source", type=str, required=True, help="Data source pipeline (e.g. abm, odoo)")
    args = parser.parse_args()

    # Load environment variables for the specified profile before anything else
    active_profile = load_env(args.profile)
    report_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    print("\n" + "="*70)
    print(f" ELT PIPELINE SUMMARY REPORT - {report_time}")
    print(f" PROFILE: {active_profile}")
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
        
    audit_output = io.StringIO()
    if test_data_counts:
        # Capture stdout from test_data_counts while printing live
        class TeeOutput(object):
            def __init__(self, stdout, buffer):
                self.stdout = stdout
                self.buffer = buffer
            def write(self, text):
                self.stdout.write(text)
                self.buffer.write(text)
            def flush(self):
                self.stdout.flush()
                self.buffer.flush()

        old_stdout = sys.stdout
        sys.stdout = TeeOutput(old_stdout, audit_output)
        failed = False
        try:
            test_data_counts.main(active_profile, source=args.source)
        except SystemExit as e:
            if e.code != 0:
                failed = True
        finally:
            sys.stdout = old_stdout

        if failed:
            print("\n  [!] Quality gate failure detected during data verification.")
    else:
        print("\n[ DATA VERIFICATION ]")
        print("  test_data_counts module not found.")

    # Write Markdown Reconciliation Summary Report
    try:
        reports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'reports'))
        os.makedirs(reports_dir, exist_ok=True)
        
        md_content = generate_markdown_report(active_profile, args.source, metrics, dbt_res, audit_output.getvalue(), report_time)
        
        latest_report_path = os.path.join(reports_dir, 'reconciliation_summary.md')
        with open(latest_report_path, 'w', encoding='utf-8') as f:
            f.write(md_content)

        profile_report_path = os.path.join(reports_dir, f'reconciliation_summary_{active_profile}.md')
        with open(profile_report_path, 'w', encoding='utf-8') as f:
            f.write(md_content)

        print(f"\n[ RECONCILIATION SUMMARY REPORT SAVED ]")
        print(f"  -> {latest_report_path}")
        print(f"  -> {profile_report_path}\n")
    except Exception as e:
        print(f"\n[!] Failed to save markdown report: {e}")

if __name__ == "__main__":
    main()
