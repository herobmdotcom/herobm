import pymssql
import json
from decimal import Decimal
import datetime

# Handle JSON serialization for special types
class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

conn = pymssql.connect(
    server="13.236.59.199",
    user="mpg",
    password="@ThisIsForTesting26##",
    database="vau2010"
)

cursor = conn.cursor(as_dict=True)

# Let's see the schema and a few rows of LEDGER
cursor.execute("SELECT TOP 5 * FROM LEDGER")
rows = cursor.fetchall()

print("--- LEDGER Table Columns ---")
for col in cursor.description:
    print(f"{col[0]} (Type code: {col[1]})")

print("\n--- Sample Row ---")
if rows:
    print(json.dumps(rows[0], indent=2, cls=CustomEncoder))
else:
    print("No rows found.")
