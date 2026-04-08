import sys
import os
import pymssql
import argparse
from dotenv import dotenv_values

TARGET_TABLES = [
    "CUSTOMERS", "CONTACTS", "CDELADDRESSES", "CGROUPS", "SUPPLIERS", "SGROUPS", "SSUPPLIERDETAILS",
    "PRODUCTS", "PRODUCTKITS", "PSUPPLIERS", "GPRICELIST", "GPRODUCTAVERAGES", "PGROUPS", "PUNITS",
    "PLOCATIONS", "PBINS", "COMPANY",
    "PBINCONTENTS", "PLOCDETAILS",
    "TRANSHEADERS", "TRANSDETAILS", "TRANSOFFSETS", "PBINTRACKING",
    "ZSALES_ORDERS", "ZSALES_DELIVERIES", "ZSALES_QUOTES", "ZPURCHASE_ORDERS", "ZPURCHASE_INVOICES", "ZSALES_INVOICES"
]

def load_conn(env_file, cli_password=None):
    env = dotenv_values(env_file)
    if env_file == ".env.volzau":
        host = env.get("ABM_MSSQL_HOST", "13.236.59.199")
        user = env.get("ABM_MSSQL_USER", "mpg")
        password = cli_password or env.get("ABM_MSSQL_PASSWORD")
        database = env.get("ABM_MSSQL_DATABASE", "vau2010")
        port = int(env.get("ABM_MSSQL_PORT", "1433"))
    else:
        host = env.get("ABM_MSSQL_HOST")
        user = env.get("ABM_MSSQL_USER")
        password = cli_password or env.get("ABM_MSSQL_PASSWORD")
        database = env.get("ABM_MSSQL_DATABASE", "mpgtrial")
        port = int(env.get("ABM_MSSQL_PORT", "1433"))
        
    if not host or not user or not password:
        print(f"Missing required MS SQL credentials for {env_file}")
        return None
        
    try:
        addr = f"{host}:{port}"
        return pymssql.connect(server=addr, user=user, password=password, database=database, as_dict=True)
    except Exception as e:
        print(f"Failed to connect for {env_file}: {e}")
        return None

def get_schema(cursor):
    cursor.execute("""
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
    """)
    schema = {}
    for row in cursor.fetchall():
        t = row['TABLE_NAME'].upper()
        if t not in schema:
            schema[t] = {}
        schema[t][row['COLUMN_NAME'].upper()] = {
            'type': row['DATA_TYPE'],
            'len': row['CHARACTER_MAXIMUM_LENGTH']
        }
    return schema

def get_table_counts(cursor):
    cursor.execute("""
        SELECT t.name AS TableName, SUM(p.rows) AS total_rows
        FROM sys.tables t
        INNER JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0, 1)
        GROUP BY t.name
    """)
    counts = {}
    for row in cursor.fetchall():
        counts[str(row['TableName']).upper()] = int(row['total_rows'])
    return counts

def get_column_null_density(cursor, table_name, schema_cols):
    if not schema_cols: return {}
    cols = list(schema_cols.keys())
    densities = {}
    batch_size = 50
    for i in range(0, len(cols), batch_size):
        batch = cols[i:i+batch_size]
        selects = []
        for c in batch:
            dt = schema_cols[c]['type']
            if dt in ['char', 'varchar', 'nchar', 'nvarchar']:
                selects.append(f"COUNT(NULLIF(LTRIM(RTRIM([{c}])), '')) AS [{c}]")
            elif dt in ['text', 'ntext']:
                selects.append(f"COUNT(NULLIF(LTRIM(RTRIM(CAST([{c}] AS nvarchar(max)))), '')) AS [{c}]")
            elif dt == 'xml':
                selects.append(f"COUNT(NULLIF(CAST([{c}] AS nvarchar(max)), '')) AS [{c}]")
            else:
                selects.append(f"COUNT([{c}]) AS [{c}]")
                
        query = f"SELECT {', '.join(selects)} FROM [{table_name}]"
        try:
            cursor.execute(query)
            row = cursor.fetchone()
            if row:
                for c in batch:
                    densities[c] = row[c]
        except Exception as e:
            print(f"Error querying null density for {table_name}: {e}")
            for c in batch:
                densities[c] = -1
    return densities

def main():
    parser = argparse.ArgumentParser(description="ABM Structural Drift Analysis")
    parser.add_argument("--sg-password", help="Password for SG database", default=None)
    parser.add_argument("--au-password", help="Password for AU database", default=None)
    args = parser.parse_args()

    print("--- Starting ABM Structural Drift Analysis ---")
    sg_conn = load_conn(".env", args.sg_password)
    au_conn = load_conn(".env.volzau", args.au_password)
    
    if not sg_conn or not au_conn:
        sys.exit(1)

    with sg_conn.cursor() as sg_c, au_conn.cursor() as au_c:
        print("Gathering Schema [Phase 2]...")
        sg_schema = get_schema(sg_c)
        au_schema = get_schema(au_c)
        
        print("Gathering Table Row Counts [Phase 3]...")
        sg_counts = get_table_counts(sg_c)
        au_counts = get_table_counts(au_c)
        
        print("Gathering Column Densities for Core Tables [Phase 4]...")
        sg_densities = {}
        au_densities = {}
        for idx, table in enumerate(TARGET_TABLES, 1):
            print(f"  [{idx}/{len(TARGET_TABLES)}] Scanning {table}...")
            if table in sg_schema:
                sg_densities[table] = get_column_null_density(sg_c, table, sg_schema[table])
            if table in au_schema:
                au_densities[table] = get_column_null_density(au_c, table, au_schema[table])


    print("Building Report [Phase 5]...")
    report = ["# ABM Structural Drift Analysis: Singapore vs Australia\n"]
    
    # 1. Structural DB Schema Differences
    report.append("## 1. Table Presence Differences")
    all_sg_tables = set(sg_schema.keys())
    all_au_tables = set(au_schema.keys())
    
    sg_only_t = all_sg_tables - all_au_tables
    au_only_t = all_au_tables - all_sg_tables
    
    if sg_only_t:
        report.append(f"**Tables only in SG (Legacy Mode)**: {len(sg_only_t)}")
        report.append("```\n" + ", ".join(sorted(sg_only_t)[:50]) + ("..." if len(sg_only_t)>50 else "") + "\n```")
    if au_only_t:
        report.append(f"**Tables only in AU (New/Modular Features)**: {len(au_only_t)}")
        report.append("```\n" + ", ".join(sorted(au_only_t)[:50]) + ("..." if len(au_only_t)>50 else "") + "\n```")


    report.append("\n## 2. Table Usage Drift (Row Counts)")
    report.append("This checks if a globally existing Table is actively populated in one region but dormant in another.\n")
    report.append("| Table Name | SG Rows | AU Rows | Category |")
    report.append("|------------|---------|---------|----------|")
    for t in sorted(set(list(sg_counts.keys()) + list(au_counts.keys()))):
        sg_c = sg_counts.get(t, 0)
        au_c = au_counts.get(t, 0)
        if sg_c > 0 and au_c == 0:
            report.append(f"| `{t}` | {sg_c} | {au_c} | SG-Active Only |")
    # Clean loop
    for t in sorted(set(list(sg_counts.keys()) + list(au_counts.keys()))):
        sg_c = sg_counts.get(t, 0)
        au_c = au_counts.get(t, 0)
        if sg_c > 0 and au_c == 0:
            report.append(f"| `{t}` | {sg_c} | {au_c} | SG-Active Only |")
        elif au_c > 0 and sg_c == 0:
            report.append(f"| `{t}` | {sg_c} | {au_c} | AU-Active Only |")

    report.append("\n## 3. Deep Column Usage Drift (Core ELT Tables Only)")
    report.append("This section compares the 29 critical ELT tables. We highlight fields that are heavily utilized in one region but completely barren in the other.\n")
    report.append("| Table | Column | SG Population Vol | AU Population Vol | Verdict |")
    report.append("|-------|--------|-------------------|-------------------|---------|")
    
    for t in TARGET_TABLES:
        sg_d = sg_densities.get(t, {})
        au_d = au_densities.get(t, {})
        all_cols = set(list(sg_d.keys()) + list(au_d.keys()))
        for c in sorted(all_cols):
            sg_val = sg_d.get(c, 0)
            au_val = au_d.get(c, 0)
            if sg_val > 0 and au_val == 0 and au_counts.get(t, 0) > 0:
                report.append(f"| `{t}` | `{c}` | {sg_val} (populated) | 0 (empty) | Deprecated in AU |")
            elif au_val > 0 and sg_val == 0 and sg_counts.get(t, 0) > 0:
                report.append(f"| `{t}` | `{c}` | 0 (empty) | {au_val} (populated) | Novel to AU |")
            elif sg_d.get(c) == None and au_d.get(c) is not None:
                report.append(f"| `{t}` | `{c}` | *Not in Schema* | {au_val} (populated) | New DB Column in AU |")
            elif au_d.get(c) == None and sg_d.get(c) is not None:
                report.append(f"| `{t}` | `{c}` | {sg_val} (populated) | *Not in Schema* | Dropped DB Column in AU |")

                
    with open("abm_structural_differences.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report))
        
    print("\n--- Drift Analysis Complete! ---")
    print("Report written to 'abm_structural_differences.md'")

if __name__ == "__main__":
    main()
