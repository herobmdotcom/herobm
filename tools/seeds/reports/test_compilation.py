import json
import subprocess
import os

mock_quote_invoice = {
  "generatedAt": "2026-03-25 10:00:00",
  "header": {
    "orderNumber": "Q-1000",
    "name": "Pre-Validation",
    "currencyCode": "EUR",
    "customerName": "Test Client Ltda",
    "orderDate": "2026-03-25",
    "customerOrderNumber": "TST-999"
  },
  "summary": {
    "subtotal": 1250.0,
    "taxAmount": 250.0,
    "totalAmount": 1500.0
  },
  "lines": [
    {
      "productNumber": "PRD-X99",
      "description": "High Performance Widget",
      "quantity": 10,
      "uom": "pcs",
      "pricePerUnit": 125.0,
      "discountPercentage": 0,
      "gstRate": "20%",
      "amount": 1250.0
    }
  ]
}

mock_picking_slip = {
  "generatedAt": "2026-03-25 10:00:00",
  "header": {
    "orderNumber": "SO-1000",
    "customerName": "Test Client Ltda",
    "shipToAddress": "123 Test St",
    "orderDate": "2026-03-25",
    "shippingMethod": "Courier",
    "notes": "Fragile"
  },
  "lines": [
    {
      "productNumber": "PRD-X99",
      "description": "High Performance Widget",
      "binNumber": "A1",
      "qtyToPick": 5,
      "uom": "pcs"
    }
  ],
  "backOrderLines": [
    {
      "itemCode": "PRD-X99",
      "supplierName": "Supplier Inc",
      "qtyOrdered": 10,
      "qtyToOrder": 5
    }
  ]
}

os.makedirs('tools/seeds/reports', exist_ok=True)

with open('tools/seeds/reports/mock_quote_invoice.json', 'w') as f:
    json.dump(mock_quote_invoice, f)
    
with open('tools/seeds/reports/mock_picking_slip.json', 'w') as f:
    json.dump(mock_picking_slip, f)

def compile_typst(typ_file, json_file):
    print(f"Compiling {typ_file} with {json_file}...")
    res = subprocess.run([
        'typst', 'compile', f'tools/seeds/reports/{typ_file}', 
        f'tools/seeds/reports/{typ_file.replace(".typ", ".pdf")}', 
        f'--input', f'data={json_file}'
    ], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"FAILED {typ_file}:")
        print(res.stderr)
    else:
        print(f"SUCCESS {typ_file}")

compile_typst('sales-quote.typ', 'mock_quote_invoice.json')
compile_typst('sales-invoice.typ', 'mock_quote_invoice.json')
compile_typst('picking-slip.typ', 'mock_picking_slip.json')
