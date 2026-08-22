export enum SystemResource {
  CUSTOMERS = 'customers',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  SALES_ORDERS = 'sales-orders',
  SALES_RETURNS = 'sales-returns',
  SALES_CREDIT_NOTES = 'sales-credit-notes',
  PURCHASE_ORDERS = 'purchase-orders',
  PURCHASE_RETURNS = 'purchase-returns',
  PURCHASE_DEBIT_NOTES = 'purchase-debit-notes',
  SUPPLIERS = 'suppliers',
  GOODS_RECEIVED = 'goods-received',
  DASHBOARD = 'dashboard',
  SETTINGS = 'settings',
  REPORT = 'report',
  BUSINESS_REPORT = 'business_report',
  PAYMENTS = 'payments',
  SYSTEM_LOGS = 'system_logs',
  IMPORT = 'import',
  API_KEYS = 'api_keys',
  WEBHOOKS = 'webhooks',
  EVENTS = 'events',
  ROLES = 'roles',
  USERS = 'users',
  GL = 'gl',
  DATA_EXPORT = 'data-export',
  CREDIT_CONTROL = 'credit-control',
  CRM = 'crm',
  WORK_ORDERS = 'work-orders',
  FISCAL_PERIODS = 'fiscal-periods',
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
