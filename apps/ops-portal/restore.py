import sys, json

original_columns = {
  'productNumber': 'Product # (SKU)',
  'productId': 'Product ID',
  'vendor': 'Default Vendor',
  'stdCost': 'Standard cost',
  'listPrice': 'List Price',
  'tradePrice': 'Trade Price',
  'priceLevel3': 'Level 3',
  'priceLevel4': 'Level 4',
  'barcode': 'Barcode',
  'purchaseTaxCategory': 'Purchase Tax Category',
  'salesTaxCategory': 'Sales Tax Category',
  'alternateProductNumber': 'Alternate Product Number',
  'quantityOnHand': 'Qty On Hand',
  'uomCode': 'UoM Code',
  'ratio': 'Ratio',
  'ratioBase': 'Ratio (x Base)',
  'notes': 'Notes',
  'parentQuantity': 'Parent Quantity',
  'quantity': 'Component Quantity',
  "sequenceNumber": "Sequence Number",
  "name": "Name",
  "baseUom": "Base UoM"
}

with open('messages/en.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

if 'products' in data and 'columns' in data['products']:
    current_columns = data['products']['columns']
    for k, v in original_columns.items():
        if k not in current_columns:
            current_columns[k] = v

with open('messages/en.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
