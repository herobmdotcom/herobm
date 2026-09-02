export enum SystemResource {
  // Dashboard
  DASHBOARD = 'dashboard',

  // Sales
  CUSTOMERS = 'customers',
  SALES_ORDERS = 'sales-orders',
  SALES_RETURNS = 'sales-returns',
  SALES_CREDIT_NOTES = 'sales-credit-notes',

  // Inventory
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  GOODS_RECEIVED = 'goods-received',

  // Purchasing
  SUPPLIERS = 'suppliers',
  PURCHASE_ORDERS = 'purchase-orders',
  PURCHASE_RETURNS = 'purchase-returns',
  PURCHASE_DEBIT_NOTES = 'purchase-debit-notes',

  // Manufacturing
  WORK_ORDERS = 'work-orders',

  // CRM
  CRM = 'crm',

  // Finance
  GL = 'gl',
  CREDIT_CONTROL = 'credit-control',
  PAYMENTS = 'payments',
  FISCAL_PERIODS = 'fiscal-periods',

  // Reporting
  REPORT = 'report',
  BUSINESS_REPORT = 'business_report',

  // Admin
  SETTINGS = 'settings',
  USERS = 'users',
  ROLES = 'roles',

  // Technical
  API_KEYS = 'api_keys',
  WEBHOOKS = 'webhooks',
  DATA_EXPORT = 'data-export',
  IMPORT = 'import',
  EVENTS = 'events',
  SYSTEM_LOGS = 'system_logs',
}

export interface Permission {
  resource: string;
  action: string;
  effect: string;
}

export function hasPermission(
  permissions: Permission[],
  resource: SystemResource,
  action: string = 'read'
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.some(
    (p) => p.resource === resource && p.action === action && p.effect === 'allow'
  );
}

export function hasAnyPermission(
  permissions: Permission[],
  resources: SystemResource[],
  action: string = 'read'
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.some(
    (p) => resources.includes(p.resource as SystemResource) && p.action === action && p.effect === 'allow'
  );
}
