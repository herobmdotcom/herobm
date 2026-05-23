import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv(".env.volzau")

print("Running dbt transform for import_gl_accounts...")
# Run dbt via poetry or venv
dbt_cmd = "cd pipelines/abm_transform && dbt run --select import_gl_accounts --target elt"
ret = os.system(dbt_cmd)
if ret != 0:
    print("dbt failed!")
    exit(1)

print("dbt complete. Querying modbm_core.gl_accounts...")

# Query Postgres
conn = psycopg2.connect(
    host=os.environ["POSTGRES_HOST"],
    port=os.environ["POSTGRES_PORT"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    database=os.environ["POSTGRES_DB"]
)
cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) if hasattr(psycopg2, "extras") else conn.cursor()
cursor.execute("SELECT * FROM modbm_core.gl_accounts LIMIT 3")
rows = cursor.fetchall()

print("\n--- SAMPLE ROWS INSERTED ---")
# Manually format rows to dict if not using RealDictCursor
if not hasattr(psycopg2, "extras"):
    colnames = [desc[0] for desc in cursor.description]
    res = [dict(zip(colnames, row)) for row in rows]
else:
    res = rows

def default_serializer(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return str(obj)

for r in res:
    print(json.dumps(r, indent=2, default=default_serializer))
