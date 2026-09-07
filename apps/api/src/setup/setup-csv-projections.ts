import { eq, sql } from 'drizzle-orm';
import {
  customers,
  suppliers,
  actors,
  customerGroups,
  supplierGroups,
  tradingTerms,
  taxPositions,
  products,
  productGroups,
  uomDictionary,
  salesOrders,
  locations,
} from '@herobm/db-schema';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import type { ExportCsvQueryDto } from './setup.dto';

export interface CsvExportProjection {
  id: string;
  name: string;
  baseTableId: string;
  uniqueKey: string;
  columns: string[];
  execute: (
    db: DrizzleDB,
    options: ExportCsvQueryDto,
  ) => Promise<{
    headers: string[];
    rows: Record<string, unknown>[];
  }>;
}

export const CUSTOMERS_EXTENDED: CsvExportProjection = {
  id: 'customers_extended',
  name: 'Customers (Extended)',
  baseTableId: 'customers',
  uniqueKey: 'customer_number',
  columns: [
    'customer_number',
    'customer_name',
    'customer_group_code',
    'customer_group_name',
    'state_code',
    'currency_code',
    'price_tier',
    'credit_limit',
    'is_on_credit_hold',
    'business_number',
    'email',
    'telephone',
    'website',
    'industry',
    'trading_terms',
    'tax_position',
    'bank_account_name',
    'bank_bsb',
    'bank_account_number',
    'address_line1',
    'address_line2',
    'city',
    'state_province',
    'postal_code',
    'country',
    'notes',
  ],
  execute: async (db: DrizzleDB, options: ExportCsvQueryDto) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic query builder
    let query: any = db
      .select({
        customer_number: customers.customerNumber,
        customer_name: actors.name,
        customer_group_code: customerGroups.groupCode,
        customer_group_name: customerGroups.name,
        state_code: customers.stateCode,
        currency_code: customers.currencyCode,
        price_tier: customers.priceTier,
        credit_limit: customers.creditLimit,
        is_on_credit_hold: customers.isOnCreditHold,
        business_number: actors.businessNumber,
        email: actors.email,
        telephone: actors.telephone,
        website: actors.website,
        industry: actors.industry,
        trading_terms: tradingTerms.description,
        tax_position: taxPositions.title,
        bank_account_name: customers.bankAccountName,
        bank_bsb: customers.bankBsb,
        bank_account_number: customers.bankAccountNumber,
        address_line1: actors.headquartersAddressLine1,
        address_line2: actors.headquartersAddressLine2,
        city: actors.headquartersCity,
        state_province: actors.headquartersStateOrProvince,
        postal_code: actors.headquartersPostalCode,
        country: actors.headquartersCountry,
        notes: customers.notes,
      })
      .from(customers)
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .leftJoin(
        customerGroups,
        eq(customers.customerGroupId, customerGroups.customerGroupId),
      )
      .leftJoin(
        tradingTerms,
        eq(customers.tradingTermsId, tradingTerms.tradingTermsId),
      )
      .leftJoin(
        taxPositions,
        eq(customers.taxPositionId, taxPositions.taxPositionId),
      );

    if (!options.includeArchived) {
      query = query.where(sql`${customers.stateCode} != 'archived'`);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rows = (await query) as Record<string, unknown>[];
    return {
      headers: CUSTOMERS_EXTENDED.columns,
      rows,
    };
  },
};

export const SUPPLIERS_EXTENDED: CsvExportProjection = {
  id: 'suppliers_extended',
  name: 'Suppliers (Extended)',
  baseTableId: 'suppliers',
  uniqueKey: 'vendor_number',
  columns: [
    'vendor_number',
    'supplier_name',
    'supplier_group_code',
    'supplier_group_name',
    'state_code',
    'currency_code',
    'business_number',
    'email',
    'telephone',
    'website',
    'trading_terms',
    'tax_position',
    'bank_account_name',
    'bank_bsb',
    'bank_account_number',
    'address_line1',
    'address_line2',
    'city',
    'state_province',
    'postal_code',
    'country',
    'notes',
  ],
  execute: async (db: DrizzleDB, options: ExportCsvQueryDto) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic query builder
    let query: any = db
      .select({
        vendor_number: suppliers.vendorNumber,
        supplier_name: actors.name,
        supplier_group_code: supplierGroups.groupCode,
        supplier_group_name: supplierGroups.name,
        state_code: suppliers.stateCode,
        currency_code: suppliers.currencyCode,
        business_number: actors.businessNumber,
        email: actors.email,
        telephone: actors.telephone,
        website: actors.website,
        trading_terms: tradingTerms.description,
        tax_position: taxPositions.title,
        bank_account_name: suppliers.bankAccountName,
        bank_bsb: suppliers.bankBsb,
        bank_account_number: suppliers.bankAccountNumber,
        address_line1: actors.headquartersAddressLine1,
        address_line2: actors.headquartersAddressLine2,
        city: actors.headquartersCity,
        state_province: actors.headquartersStateOrProvince,
        postal_code: actors.headquartersPostalCode,
        country: actors.headquartersCountry,
        notes: suppliers.notes,
      })
      .from(suppliers)
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .leftJoin(
        supplierGroups,
        eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
      )
      .leftJoin(
        tradingTerms,
        eq(suppliers.tradingTermsId, tradingTerms.tradingTermsId),
      )
      .leftJoin(
        taxPositions,
        eq(suppliers.taxPositionId, taxPositions.taxPositionId),
      );

    if (!options.includeArchived) {
      query = query.where(sql`${suppliers.stateCode} != 'archived'`);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rows = (await query) as Record<string, unknown>[];
    return {
      headers: SUPPLIERS_EXTENDED.columns,
      rows,
    };
  },
};

export const PRODUCTS_EXTENDED: CsvExportProjection = {
  id: 'products_extended',
  name: 'Products (Extended)',
  baseTableId: 'products',
  uniqueKey: 'product_number',
  columns: [
    'product_number',
    'name',
    'product_type',
    'structure_type',
    'product_group_code',
    'product_group_name',
    'base_uom',
    'base_uom_description',
    'barcode',
    'list_price',
    'standard_cost',
    'trade_price',
    'weighted_average_cost',
    'weight',
    'state_code',
    'notes',
  ],
  execute: async (db: DrizzleDB, options: ExportCsvQueryDto) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic query builder
    let query: any = db
      .select({
        product_number: products.productNumber,
        name: products.name,
        product_type: products.productType,
        structure_type: products.structureType,
        product_group_code: productGroups.groupCode,
        product_group_name: productGroups.name,
        base_uom: products.baseUom,
        base_uom_description: uomDictionary.description,
        barcode: products.barcode,
        list_price: products.listPrice,
        standard_cost: products.standardCost,
        trade_price: products.tradePrice,
        weighted_average_cost: products.weightedAverageCost,
        weight: products.weight,
        state_code: products.stateCode,
        notes: products.notes,
      })
      .from(products)
      .leftJoin(
        productGroups,
        eq(products.productGroupId, productGroups.productGroupId),
      )
      .leftJoin(uomDictionary, eq(products.baseUom, uomDictionary.uomCode));

    if (!options.includeArchived) {
      query = query.where(sql`${products.stateCode} != 'archived'`);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rows = (await query) as Record<string, unknown>[];
    return {
      headers: PRODUCTS_EXTENDED.columns,
      rows,
    };
  },
};

export const SALES_ORDERS_EXTENDED: CsvExportProjection = {
  id: 'sales_orders_extended',
  name: 'Sales Orders (Extended)',
  baseTableId: 'sales_orders',
  uniqueKey: 'order_number',
  columns: [
    'order_number',
    'name',
    'customer_number',
    'customer_name',
    'fulfillment_location_code',
    'fulfillment_location_name',
    'state_code',
    'base_total_amount',
    'currency_code',
    'exchange_rate',
    'customer_order_number',
    'delivery_company_name',
    'delivery_name',
    'delivery_phone',
    'delivery_address_line1',
    'delivery_city',
    'delivery_state',
    'delivery_postal_code',
    'delivery_country',
    'terms_description',
    'notes',
    'shipping_notes',
  ],
  execute: async (db: DrizzleDB, options: ExportCsvQueryDto) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic query builder
    let query: any = db
      .select({
        order_number: salesOrders.orderNumber,
        name: salesOrders.name,
        customer_number: customers.customerNumber,
        customer_name: actors.name,
        fulfillment_location_code: locations.code,
        fulfillment_location_name: locations.name,
        state_code: salesOrders.stateCode,
        base_total_amount: salesOrders.baseTotalAmount,
        currency_code: salesOrders.currencyCode,
        exchange_rate: salesOrders.exchangeRate,
        customer_order_number: salesOrders.customerOrderNumber,
        delivery_company_name: salesOrders.deliveryCompanyName,
        delivery_name: salesOrders.deliveryName,
        delivery_phone: salesOrders.deliveryPhone,
        delivery_address_line1: salesOrders.deliveryAddressLine1,
        delivery_city: salesOrders.deliveryCity,
        delivery_state: salesOrders.deliveryState,
        delivery_postal_code: salesOrders.deliveryPostalCode,
        delivery_country: salesOrders.deliveryCountry,
        terms_description: salesOrders.termsDescription,
        notes: salesOrders.notes,
        shipping_notes: salesOrders.shippingNotes,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.customerId))
      .leftJoin(actors, eq(customers.actorId, actors.actorId))
      .leftJoin(
        locations,
        eq(salesOrders.fulfillmentLocationId, locations.locationId),
      );

    if (!options.includeArchived) {
      query = query.where(sql`${salesOrders.stateCode} != 'archived'`);
    }

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rows = (await query) as Record<string, unknown>[];
    return {
      headers: SALES_ORDERS_EXTENDED.columns,
      rows,
    };
  },
};

const PROJECTIONS: Record<string, CsvExportProjection> = {
  customers_extended: CUSTOMERS_EXTENDED,
  suppliers_extended: SUPPLIERS_EXTENDED,
  products_extended: PRODUCTS_EXTENDED,
  sales_orders_extended: SALES_ORDERS_EXTENDED,
};

export function hasCsvProjection(id: string): boolean {
  return Boolean(PROJECTIONS[id]);
}

export function getCsvProjection(id: string): CsvExportProjection | undefined {
  return PROJECTIONS[id];
}

export function getAllCsvProjections(): CsvExportProjection[] {
  return Object.values(PROJECTIONS);
}
