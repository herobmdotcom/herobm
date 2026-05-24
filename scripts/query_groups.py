import pymssql
import json

conn = pymssql.connect(
    server="13.236.59.199",
    user="mpg",
    password="<REDACTED>",
    database="vau2010"
)

cursor = conn.cursor(as_dict=True)

print("--- DISTINCT GroupCode / AccountGroup in LEDGER ---")
cursor.execute("SELECT DISTINCT GroupCode, AccountGroup FROM LEDGER ORDER BY GroupCode")
for row in cursor.fetchall():
    print(f"{row['GroupCode']} -> {row['AccountGroup']}")

print("\n--- Checking for LGROUPS table ---")
try:
    cursor.execute("SELECT TOP 5 * FROM LGROUPS")
    print("LGROUPS exists. Columns:")
    for col in cursor.description:
        print(col[0])
    print("Sample row:")
    print(cursor.fetchall()[0])
except Exception as e:
    print("No LGROUPS table:", e)
