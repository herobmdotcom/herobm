import re

def extract_keys(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract data.* accesses
    data_keys = re.findall(r'data\.([a-zA-Z0-9_\.]+)', content)
    # Extract line.* accesses
    line_keys = re.findall(r'line\.([a-zA-Z0-9_]+)', content)
    
    print(f"--- {filename} ---")
    print("Data keys:", sorted(set(data_keys)))
    print("Line keys:", sorted(set(line_keys)))

extract_keys('sales-quote.typ')
extract_keys('sales-invoice.typ')
extract_keys('picking-slip.typ')
