import {
  pgSchema,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema mapping the dbt marts layer (read-only in Phase 2).
 * Column names match the CDM/Schema.org naming used in dbt mart models.
 */
export const marts = pgSchema('public_marts');

// ---------------------------------------------------------------------------
// mart_accounts  (CDM: Account)
// ---------------------------------------------------------------------------
export const accounts = marts.table('mart_accounts', {
  accountId: text('account_id').primaryKey(),
  accountNumber: text('account_number'),
  name: text('name'),
  address1Line1: text('address1_line1'),
  address1Line2: text('address1_line2'),
  address1City: text('address1_city'),
  address1StateOrProvince: text('address1_state_or_province'),
  address1PostalCode: text('address1_postal_code'),
  address1Country: text('address1_country'),
  telephone1: text('telephone1'),
  fax: text('fax'),
  emailAddress1: text('email_address1'),
  primaryContactName: text('primary_contact_name'),
  primaryContactEmail: text('primary_contact_email'),
  primaryContactPhone: text('primary_contact_phone'),
  customerGroup: text('customer_group'),
  stateCode: text('state_code'),
  gstPosition: text('gst_position'),
  currencyCode: text('currency_code'),
  createdOn: timestamp('created_on'),
  deliveryAddressCount: integer('delivery_address_count'),
  priceScale: integer('price_scale'),
  groupDiscount: numeric('group_discount'),
  customerDiscount: numeric('customer_discount'),
});

// ---------------------------------------------------------------------------
// mart_products  (CDM: Product)
// ---------------------------------------------------------------------------
export const products = marts.table('mart_products', {
  productId: text('product_id').primaryKey(),
  productNumber: text('product_number'),
  name: text('name'),
  productGroupName: text('product_group_name'),
  defaultVendorId: text('default_vendor_id'),
  defaultVendorName: text('default_vendor_name'),
  standardCost: numeric('standard_cost'),
  listPrice: numeric('list_price'),
  tradePrice: numeric('trade_price'),
  priceLevel3: numeric('price_level_3'),
  priceLevel4: numeric('price_level_4'),
  barcode: text('barcode'),
  stateCode: text('state_code'),
  gstCategory: text('gst_category'),
  scNumber: text('sc_number'),
  createdOn: timestamp('created_on'),
});

// ---------------------------------------------------------------------------
// mart_inventory  (Schema.org: InventoryLevel)
// ---------------------------------------------------------------------------
export const inventory = marts.table('mart_inventory', {
  inventoryLevelId: text('inventory_level_id').primaryKey(),
  productId: text('product_id'),
  productNumber: text('product_number'),
  productName: text('product_name'),
  scNumber: text('sc_number'),
  locationNo: text('location_no'),
  locationName: text('location_name'),
  quantityOnHand: numeric('quantity_on_hand'),
  quantityCommitted: numeric('quantity_committed'),
  quantityOnOrder: numeric('quantity_on_order'),
  quantityAvailable: numeric('quantity_available'),
  quantityReserved: numeric('quantity_reserved'),
  quantityBackOrdered: numeric('quantity_back_ordered'),
  minQuantity: numeric('min_quantity'),
  maxQuantity: numeric('max_quantity'),
  valueOnHand: numeric('value_on_hand'),
  lastInUnitCost: numeric('last_in_unit_cost'),
  defaultBinNumber: text('default_bin_number'),
});

// ---------------------------------------------------------------------------
// mart_bin_contents  (Custom: BinStock)
// ---------------------------------------------------------------------------
export const binContents = marts.table('mart_bin_contents', {
  binContentsId: text('bin_contents_id').primaryKey(),
  binId: text('bin_id'),
  binNumber: text('bin_number'),
  binType: text('bin_type'),
  locationNo: text('location_no'),
  locationName: text('location_name'),
  productId: text('product_id'),
  productNumber: text('product_number'),
  productName: text('product_name'),
  actualQuantity: numeric('actual_quantity'),
  baseQuantity: numeric('base_quantity'),
  isConsignment: boolean('is_consignment'),
  isBonded: boolean('is_bonded'),
  isUnavailable: boolean('is_unavailable'),
});

// ---------------------------------------------------------------------------
// mart_sales_order_lines  (CDM: SalesOrderProduct)
// ---------------------------------------------------------------------------
export const salesOrderLines = marts.table('mart_sales_order_lines', {
  salesOrderLineId: text('sales_order_line_id').primaryKey(),
  lineItemId: text('line_item_id'),
  lineNumber: integer('line_number'),
  orderReference: text('order_reference'),
  documentNumber: text('document_number'),
  documentDate: timestamp('document_date'),
  orderNumber: text('order_number'),
  customerOrderNumber: text('customer_order_number'),
  accountId: text('account_id'),
  accountNumber: text('account_number'),
  accountName: text('account_name'),
  productId: text('product_id'),
  productNumber: text('product_number'),
  productDescription: text('product_description'),
  unitOfMeasure: text('unit_of_measure'),
  quantity: numeric('quantity'),
  pricePerUnit: numeric('price_per_unit'),
  discountPercentage: numeric('discount_percentage'),
  amount: numeric('amount'),
  tax: numeric('tax'),
  totalAmount: numeric('total_amount'),
  quantityDelivered: numeric('quantity_delivered'),
  quantityInvoiced: numeric('quantity_invoiced'),
  isFullyDelivered: boolean('is_fully_delivered'),
  isFullyInvoiced: boolean('is_fully_invoiced'),
  documentTotalIncTax: numeric('document_total_inc_tax'),
});

// ---------------------------------------------------------------------------
// mart_suppliers  (CDM: Vendor)
// ---------------------------------------------------------------------------
export const suppliers = marts.table('mart_suppliers', {
  vendorId: text('vendor_id').primaryKey(),
  vendorNumber: text('vendor_number'),
  name: text('name'),
  vendorGroup: text('vendor_group'),
  address1Line1: text('address1_line1'),
  address1Line2: text('address1_line2'),
  address1City: text('address1_city'),
  address1StateOrProvince: text('address1_state_or_province'),
  address1PostalCode: text('address1_postal_code'),
  address1Country: text('address1_country'),
  telephone1: text('telephone1'),
  fax: text('fax'),
  emailAddress1: text('email_address1'),
  stateCode: text('state_code'),
  createdOn: timestamp('created_on'),
  productCount: integer('product_count'),
});

// ---------------------------------------------------------------------------
// mart_purchase_order_lines  (CDM: PurchaseOrderProduct)
// ---------------------------------------------------------------------------
export const purchaseOrderLines = marts.table('mart_purchase_order_lines', {
  purchaseOrderLineId: text('purchase_order_line_id').primaryKey(),
  lineItemId: text('line_item_id'),
  lineNumber: integer('line_number'),
  orderReference: text('order_reference'),
  documentNumber: text('document_number'),
  documentDate: timestamp('document_date'),
  orderNumber: text('order_number'),
  vendorId: text('vendor_id'),
  vendorNumber: text('vendor_number'),
  vendorName: text('vendor_name'),
  productId: text('product_id'),
  productNumber: text('product_number'),
  productDescription: text('product_description'),
  supplierPartNumber: text('supplier_part_number'),
  unitOfMeasure: text('unit_of_measure'),
  quantity: numeric('quantity'),
  pricePerUnit: numeric('price_per_unit'),
  discountPercentage: numeric('discount_percentage'),
  amount: numeric('amount'),
  tax: numeric('tax'),
  totalAmount: numeric('total_amount'),
  quantityDelivered: numeric('quantity_delivered'),
  quantityInvoiced: numeric('quantity_invoiced'),
  isFullyDelivered: boolean('is_fully_delivered'),
  isFullyInvoiced: boolean('is_fully_invoiced'),
  documentTotalExTax: numeric('document_total_ex_tax'),
  documentTotalTax: numeric('document_total_tax'),
  documentTotalIncTax: numeric('document_total_inc_tax'),
});

// ---------------------------------------------------------------------------
// mart_product_suppliers  (CDM: ProductVendor — many-to-many junction)
// ---------------------------------------------------------------------------
export const productSuppliers = marts.table('mart_product_suppliers', {
  productSupplierId: text('product_supplier_id').primaryKey(),
  productId: text('product_id'),
  productNumber: text('product_number'),
  productName: text('product_name'),
  vendorId: text('vendor_id'),
  vendorNumber: text('vendor_number'),
  vendorName: text('vendor_name'),
  supplierPartNumber: text('supplier_part_number'),
  costPrice: numeric('cost_price'),
  costPrice2: numeric('cost_price_2'),
  discountPercent: numeric('discount_percent'),
  priceBreakQuantity: numeric('price_break_quantity'),
  isPreferred: boolean('is_preferred'),
  minPurchaseQty: numeric('min_purchase_qty'),
  purchaseUnit: text('purchase_unit'),
  effectiveFrom: timestamp('effective_from'),
  effectiveTo: timestamp('effective_to'),
});
