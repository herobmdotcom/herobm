import { config } from 'dotenv';
config({ path: '.env' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { businessReports } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

async function seedBusinessReports() {
  const connectionString =
    process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
  if (!process.env.POSTGRES_USER) {
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
            id: 'month',
            label: 'Month',
            field: 'yearMonth',
            headerName: 'Month',
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
            id: 'month',
            label: 'Month',
            field: 'yearMonth',
            headerName: 'Month',
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
            id: 'month',
            label: 'Month',
            field: 'yearMonth',
            headerName: 'Month',
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
          { field: 'yearMonth', headerName: 'Month', flex: 1 },
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
          xAxisField: 'yearMonth',
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
            id: 'month',
            label: 'Month',
            field: 'yearMonth',
            headerName: 'Month',
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
