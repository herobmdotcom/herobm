import re

path = r'c:\Users\Marcel\volz\modbm\modbm\pipelines\abm_extract\pipeline.py'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix all occurrences of credentials=conn_str to credentials=build_connection_credentials()
code = re.sub(r'credentials=conn_str,', 'credentials=build_connection_credentials(),', code)
# Also fix credentials=build_connection_string()
code = re.sub(r'credentials=build_connection_string\(\),', 'credentials=build_connection_credentials(),', code)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed pipeline.py")
