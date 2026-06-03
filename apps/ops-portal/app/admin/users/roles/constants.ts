import { SystemResource } from '@modbm/shared';

export const RESOURCES = Object.values(SystemResource);

export const ACTIONS = ['read', 'write', 'archive', 'handle', 'invoice'];

export const VALID_ACTIONS: Record<string, string[]> = {
  'customers': ['read', 'write', 'archive'],
  'products': ['read', 'write', 'archive'],
  'inventory': ['read', 'write', 'archive', 'handle'],
  'sales-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'sales-returns': ['read', 'write', 'archive', 'handle', 'invoice'],
  'purchase-orders': ['read', 'write', 'archive', 'handle', 'invoice'],
  'purchase-returns': ['read', 'write', 'archive', 'handle', 'invoice'],
  'purchase-debit-notes': ['read', 'write', 'archive', 'handle', 'invoice'],
  'suppliers': ['read', 'write', 'archive'],
  'receptions': ['read', 'write', 'archive', 'handle'],
  'goods-received': ['read', 'write', 'archive', 'handle'],
  'dashboard': ['read'],
  'tax-categories': ['read', 'write', 'archive'],
  'settings': ['read', 'write', 'archive'],
  'report': ['read', 'write', 'archive'],
  'business_report': ['read', 'write', 'archive'],
  'external_api': ['read', 'write', 'archive'],
  'payments': ['read', 'write', 'archive'],
  'system_logs': ['read', 'write', 'archive'],
  'import': ['read', 'write', 'archive'],
  'api_keys': ['read', 'write', 'archive'],
  'webhooks': ['read', 'write', 'archive'],
  'events': ['read', 'write', 'archive'],
  'roles': ['read', 'write', 'archive'],
  'users': ['read', 'write', 'archive'],
  'gl': ['read', 'write'],
  'locations': ['read', 'write', 'archive'],
};
