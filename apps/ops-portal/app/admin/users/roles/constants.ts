import { SystemResource } from '@herobm/shared';

export const RESOURCES = Object.values(SystemResource);

export const ACTIONS = ['read', 'write', 'archive', 'handle', 'invoice', 'delete'];

export const VALID_ACTIONS: Record<string, string[]> = {
  // Dashboard
  'dashboard': ['read'],

  // Sales
  'customers': ['read', 'write', 'archive'],
  'sales-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'sales-returns': ['read', 'write', 'handle'],
  'sales-credit-notes': ['read', 'invoice'],

  // Inventory
  'products': ['read', 'write', 'archive'],
  'inventory': ['read', 'write'],
  'goods-received': ['read', 'write', 'handle'],

  // Purchasing
  'suppliers': ['read', 'write', 'archive'],
  'purchase-orders': ['read', 'write', 'archive', 'invoice'],
  'purchase-returns': ['read', 'write', 'handle'],
  'purchase-debit-notes': ['read', 'write'],

  // Manufacturing
  'work-orders': ['read', 'write'],

  // CRM
  'crm': ['read', 'write', 'archive', 'delete'],

  // Finance
  'gl': ['read', 'write'],
  'credit-control': ['read', 'write'],
  'payments': ['read', 'write'],
  'fiscal-periods': ['read', 'write'],

  // Reporting
  'report': ['read', 'write'],
  'business_report': ['read', 'write', 'archive'],

  // Admin
  'settings': ['read', 'write'],
  'users': ['read', 'write'],
  'roles': ['read', 'write'],

  // Technical
  'api_keys': ['read', 'write'],
  'webhooks': ['read', 'write'],
  'data-export': ['read'],
  'import': ['read', 'write'],
  'events': ['write'],
  'system_logs': ['read'],
};
