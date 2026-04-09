const fs = require('fs');

const enJsonPath = 'apps/ops-portal/messages/en.json';
const enRaw = fs.readFileSync(enJsonPath, 'utf8');
const en = JSON.parse(enRaw);

if (!en.products) en.products = {};
if (!en.products.supplierModal) {
  en.products.supplierModal = {
    title: 'Link Supplier',
    inputs: {
      searchSupplier: 'Search & Select Supplier',
      searchPlaceholder: 'Type at least 2 characters to search...',
      noSuppliersFound: 'No suppliers found matching "{search}"',
      supplierSelected: 'Supplier selected and ready.',
      supplierPartNo: 'Supplier Part No.',
      costPrice: 'Cost Price'
    },
    buttons: {
      cancel: 'Cancel',
      linkProduct: 'Link Product'
    },
    messages: {
      success: 'Supplier successfully linked',
      selectDropdown: 'Please select a supplier from the dropdown'
    }
  };
}

fs.writeFileSync(enJsonPath, JSON.stringify(en, null, 2));
console.log('JSON updated successfully');
