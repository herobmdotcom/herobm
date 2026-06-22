import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../../../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { businessReports } from '../drizzle/herobm-core-schema';
import { eq } from 'drizzle-orm';

async function seedBusinessReports() {
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5432';
  const user = process.env.POSTGRES_USER || 'postgres';
  const dbName = process.env.POSTGRES_DB || 'herobm';

  const connectionString =
    process.env.DATABASE_URL ||
    `postgres://${user}:${process.env.POSTGRES_PASSWORD}@${host}:${port}/${dbName}`;

  if (!process.env.POSTGRES_USER && !process.env.DATABASE_URL) {
    throw new Error('Database connection details not set in .env');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Seeding business reports...');

  const reports = [
    {
      slug: 'profit-and-loss',
      name: 'Profit & Loss',
      description:
        'Standard Profit and Loss statement grouping accounts by type.',
      dataSourceHook: 'financial-gl',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          {
            field: 'accountType',
            headerName: 'Type',
            hide: true,
          },
          { field: 'accountCode', headerName: 'Code' },
          { field: 'accountName', headerName: 'Account' },
          { field: 'balance', headerName: 'Balance', type: 'numericColumn' },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
      },
    },
    {
      slug: 'balance-sheet',
      name: 'Balance Sheet',
      description:
        'Standard Balance Sheet grouping assets, liabilities and equity.',
      dataSourceHook: 'financial-gl',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          {
            field: 'accountType',
            headerName: 'Type',
            hide: true,
          },
          { field: 'accountCode', headerName: 'Code' },
          { field: 'accountName', headerName: 'Account' },
          { field: 'balance', headerName: 'Balance', type: 'numericColumn' },
        ],
        filters: [{ type: 'date', name: 'toDate', label: 'As Of Date' }],
      },
    },
    {
      slug: 'sales-by-customer',
      name: 'Sales by Customer',
      description:
        'Performance report aggregating total sales volume and order counts grouped by customer.',
      dataSourceHook: 'sales-performance-customer',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'customerName', headerName: 'Customer', flex: 1 },
          {
            field: 'orderCount',
            headerName: 'Order Count',
            type: 'numericColumn',
          },
          {
            field: 'totalSales',
            headerName: 'Total Sales',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
          {
            id: 'period',
            label: 'Period',
            field: 'period',
            headerName: 'Period',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'customerName',
          yAxisField: 'totalSales',
          seriesName: 'Total Sales',
        },
      },
    },
    {
      slug: 'sales-by-product',
      name: 'Sales by Product',
      description:
        'Performance report aggregating quantity sold and total revenue per product SKU.',
      dataSourceHook: 'sales-performance-product',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'quantitySold',
            headerName: 'Qty Sold',
            type: 'numericColumn',
          },
          {
            field: 'totalSales',
            headerName: 'Total Sales',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'customer',
            label: 'Customer',
            field: 'customerName',
            headerName: 'Customer',
            flex: 1,
          },
          {
            id: 'period',
            label: 'Period',
            field: 'period',
            headerName: 'Period',
            flex: 1,
          },
          {
            id: 'channel',
            label: 'Channel',
            field: 'source',
            headerName: 'Channel',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'productName',
          yAxisField: 'totalSales',
          seriesName: 'Total Sales',
        },
      },
    },
    {
      slug: 'sales-by-product-group',
      name: 'Sales by Product Group',
      description:
        'Performance report rolling up sales revenue and quantity into product categories.',
      dataSourceHook: 'sales-performance-product-group',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productGroupName', headerName: 'Product Group', flex: 1 },
          {
            field: 'quantitySold',
            headerName: 'Qty Sold',
            type: 'numericColumn',
          },
          {
            field: 'totalSales',
            headerName: 'Total Sales',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
          {
            id: 'customer',
            label: 'Customer',
            field: 'customerName',
            headerName: 'Customer',
            flex: 1,
          },
          {
            id: 'period',
            label: 'Period',
            field: 'period',
            headerName: 'Period',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'productGroupName',
          yAxisField: 'totalSales',
          seriesName: 'Total Sales',
        },
      },
    },
    {
      slug: 'sales-trend',
      name: 'Sales Trend',
      description: 'Monthly trend of total sales revenue and order counts.',
      dataSourceHook: 'sales-performance-trend',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'period', headerName: 'Period', flex: 1 },
          {
            field: 'orderCount',
            headerName: 'Order Count',
            type: 'numericColumn',
          },
          {
            field: 'totalSales',
            headerName: 'Total Sales',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
          {
            id: 'customer',
            label: 'Customer',
            field: 'customerName',
            headerName: 'Customer',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'line',
          xAxisField: 'period',
          yAxisField: 'totalSales',
          seriesName: 'Total Sales',
        },
      },
    },
    {
      slug: 'sales-by-channel',
      name: 'Sales by Channel',
      description:
        'Performance report grouped by order creator and source channel.',
      dataSourceHook: 'sales-performance-salesperson',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'createdBy', headerName: 'Created By', flex: 1 },
          { field: 'source', headerName: 'Source Channel', flex: 1 },
          {
            field: 'orderCount',
            headerName: 'Order Count',
            type: 'numericColumn',
          },
          {
            field: 'totalSales',
            headerName: 'Total Sales',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
          {
            id: 'customer',
            label: 'Customer',
            field: 'customerName',
            headerName: 'Customer',
            flex: 1,
          },
          {
            id: 'period',
            label: 'Period',
            field: 'period',
            headerName: 'Period',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'source',
          yAxisField: 'totalSales',
          seriesName: 'Total Sales',
        },
      },
    },
    {
      slug: 'inventory-valuation',
      name: 'Inventory Valuation',
      description: 'Current inventory value and quantity on hand by product.',
      dataSourceHook: 'inventory-valuation',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'quantityOnHand',
            headerName: 'Qty on Hand',
            type: 'numericColumn',
          },
          { field: 'unitCost', headerName: 'Unit Cost', type: 'numericColumn' },
          {
            field: 'totalValue',
            headerName: 'Total Value',
            type: 'numericColumn',
          },
        ],
        filters: [],
        drillDownOptions: [
          {
            id: 'location',
            label: 'Location',
            field: 'locationName',
            headerName: 'Location',
            flex: 1,
          },
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'pie',
          xAxisField: 'productName',
          yAxisField: 'totalValue',
          seriesName: 'Total Value',
        },
      },
    },
    {
      slug: 'inventory-movements',
      name: 'Stock Movements',
      description: 'In/out movements summarizing net changes over a period.',
      dataSourceHook: 'inventory-movements',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'startingQty',
            headerName: 'Starting Qty',
            type: 'numericColumn',
          },
          { field: 'qtyIn', headerName: 'Qty In', type: 'numericColumn' },
          { field: 'qtyOut', headerName: 'Qty Out', type: 'numericColumn' },
          {
            field: 'endingQty',
            headerName: 'Ending Qty',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'location',
            label: 'Location',
            field: 'locationName',
            headerName: 'Location',
            flex: 1,
          },
          {
            id: 'movement-type',
            label: 'Movement Type',
            field: 'movementType',
            headerName: 'Type',
            flex: 1,
          },
        ],
      },
    },
    {
      slug: 'inventory-replenishment',
      name: 'Stock Replenishment',
      description:
        'Highlights products currently below their minimum or reorder levels.',
      dataSourceHook: 'inventory-replenishment',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'currentQty',
            headerName: 'Current Qty',
            type: 'numericColumn',
          },
          { field: 'minLevel', headerName: 'Min Level', type: 'numericColumn' },
          { field: 'deficit', headerName: 'Deficit', type: 'numericColumn' },
          {
            field: 'suggestedOrderQty',
            headerName: 'Suggested Order Qty',
            type: 'numericColumn',
          },
        ],
        filters: [],
        drillDownOptions: [
          {
            id: 'supplier',
            label: 'Supplier',
            field: 'supplierName',
            headerName: 'Supplier',
            flex: 1,
          },
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
        ],
      },
    },
    {
      slug: 'inventory-quarantine',
      name: 'Stock Quarantine / Aging',
      description: 'Tracks stock in quarantine or aged/expiring stock.',
      dataSourceHook: 'inventory-quarantine',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'quarantineQty',
            headerName: 'Quarantine Qty',
            type: 'numericColumn',
          },
          { field: 'reason', headerName: 'Reason', flex: 1 },
          { field: 'locationName', headerName: 'Location', flex: 1 },
        ],
        filters: [],
        drillDownOptions: [
          {
            id: 'reason',
            label: 'Reason',
            field: 'reason',
            headerName: 'Reason',
            flex: 1,
          },
          {
            id: 'location',
            label: 'Location',
            field: 'locationName',
            headerName: 'Location',
            flex: 1,
          },
        ],
      },
    },
    {
      slug: 'purchasing-supplier',
      name: 'Purchases by Supplier',
      description: 'Total spend and order volume grouped by supplier.',
      dataSourceHook: 'purchasing-supplier',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'supplierName', headerName: 'Supplier', flex: 2 },
          {
            field: 'orderCount',
            headerName: 'Order Count',
            type: 'numericColumn',
          },
          {
            field: 'totalSpend',
            headerName: 'Total Spend',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
          {
            id: 'period',
            label: 'Period',
            field: 'period',
            headerName: 'Period',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'supplierName',
          yAxisField: 'totalSpend',
          seriesName: 'Total Spend',
        },
      },
    },
    {
      slug: 'purchasing-product',
      name: 'Purchases by Product',
      description: 'Total spend and quantity purchased per product SKU.',
      dataSourceHook: 'purchasing-product',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'productNumber', headerName: 'Product No.', flex: 1 },
          { field: 'productName', headerName: 'Product Name', flex: 2 },
          {
            field: 'qtyPurchased',
            headerName: 'Qty Purchased',
            type: 'numericColumn',
          },
          {
            field: 'totalSpend',
            headerName: 'Total Spend',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
          {
            id: 'supplier',
            label: 'Supplier',
            field: 'supplierName',
            headerName: 'Supplier',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'bar',
          xAxisField: 'productName',
          yAxisField: 'totalSpend',
          seriesName: 'Total Spend',
        },
      },
    },
    {
      slug: 'purchasing-trend',
      name: 'Purchase Trend',
      description: 'Monthly trend of purchasing spend and order counts.',
      dataSourceHook: 'purchasing-trend',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'period', headerName: 'Period', flex: 1 },
          {
            field: 'orderCount',
            headerName: 'Order Count',
            type: 'numericColumn',
          },
          {
            field: 'totalSpend',
            headerName: 'Total Spend',
            type: 'numericColumn',
          },
        ],
        filters: [
          { type: 'date', name: 'fromDate', label: 'From Date' },
          { type: 'date', name: 'toDate', label: 'To Date' },
        ],
        drillDownOptions: [
          {
            id: 'product-group',
            label: 'Product Group',
            field: 'productGroupName',
            headerName: 'Product Group',
            flex: 1,
          },
          {
            id: 'supplier',
            label: 'Supplier',
            field: 'supplierName',
            headerName: 'Supplier',
            flex: 1,
          },
        ],
        chartConfig: {
          type: 'line',
          xAxisField: 'period',
          yAxisField: 'totalSpend',
          seriesName: 'Total Spend',
        },
      },
    },
    {
      slug: 'purchasing-outstanding',
      name: 'Outstanding POs',
      description: 'Open purchase orders and pending financial commitments.',
      dataSourceHook: 'purchasing-outstanding',
      isSystem: true,
      uiConfig: {
        type: 'ag-grid',
        columns: [
          { field: 'poNumber', headerName: 'PO Number', flex: 1 },
          { field: 'supplierName', headerName: 'Supplier', flex: 2 },
          { field: 'expectedDate', headerName: 'Expected Date', flex: 1 },
          {
            field: 'pendingValue',
            headerName: 'Pending Value',
            type: 'numericColumn',
          },
        ],
        filters: [{ type: 'date', name: 'toDate', label: 'Expected By' }],
        drillDownOptions: [
          {
            id: 'product',
            label: 'Product',
            field: 'productName',
            headerName: 'Product',
            flex: 2,
          },
        ],
      },
    },
  ];

  for (const report of reports) {
    const existing = await db
      .select()
      .from(businessReports)
      .where(eq(businessReports.slug, report.slug));
    if (existing.length === 0) {
      await db.insert(businessReports).values(report);
      console.log(`Inserted report: ${report.name}`);
    } else {
      await db
        .update(businessReports)
        .set(report)
        .where(eq(businessReports.slug, report.slug));
      console.log(`Updated report: ${report.name}`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

seedBusinessReports().catch((e) => {
  console.error(e);
  process.exit(1);
});
