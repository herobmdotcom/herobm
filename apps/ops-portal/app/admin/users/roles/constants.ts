import { SystemResource } from '@herobm/shared';

export const RESOURCES = Object.values(SystemResource);

export const ACTIONS = ['read', 'write', 'archive', 'handle', 'invoice', 'delete'];

export const VALID_ACTIONS: Record<string, string[]> = {
  'customers': ['read', 'write', 'archive'],
  'products': ['read', 'write', 'archive'],
  'inventory': ['read', 'write'],
  'sales-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'sales-returns': ['read', 'write', 'handle'],
  'sales-credit-notes': ['read', 'invoice'],
  'purchase-orders': ['read', 'write', 'archive', 'invoice'],
  'purchase-returns': ['read', 'write', 'handle'],
  'purchase-debit-notes': ['read', 'write'],
  'suppliers': ['read', 'write', 'archive'],
  'goods-received': ['read', 'handle'],
  'dashboard': ['read'],
  'settings': ['read', 'write'],
  'report': ['read', 'write'],
  'business_report': ['read', 'write', 'archive'],
  'payments': ['read', 'write'],
  'system_logs': ['read'],
  'import': ['read', 'write'],
  'api_keys': ['read', 'write'],
  'webhooks': ['read', 'write'],
  'events': ['write'],
  'roles': ['read', 'write'],
  'users': ['read', 'write'],
  'gl': ['read', 'write'],
  'data-export': ['read'],
  'credit-control': ['read', 'write'],
  'crm': ['read', 'write', 'archive', 'delete'],
  'work-orders': ['read', 'write'],
};
