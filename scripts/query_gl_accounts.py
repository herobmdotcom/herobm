import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv(".env.volzau")

conn = psycopg2.connect(
    host=os.environ["POSTGRES_HOST"],
    port=os.environ["POSTGRES_PORT"],
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    database=os.environ["POSTGRES_DB"]
)
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM modbm_core.gl_accounts")
count = cursor.fetchone()[0]
print(f"Total gl_accounts: {count}")

cursor.execute("SELECT * FROM modbm_core.gl_accounts LIMIT 3")
rows = cursor.fetchall()
colnames = [desc[0] for desc in cursor.description]
res = [dict(zip(colnames, row)) for row in rows]

def default_serializer(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return str(obj)

for r in res:
    print(json.dumps(r, indent=2, default=default_serializer))
