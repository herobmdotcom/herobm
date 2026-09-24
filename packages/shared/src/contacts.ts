export const ORGANIZATION_CONTACT_ROLE = {
  SALES: 'sales',
  PURCHASING: 'purchasing',
  BILLING: 'billing',
  DELIVERY: 'delivery',
} as const;

export type OrganizationContactRole =
  (typeof ORGANIZATION_CONTACT_ROLE)[keyof typeof ORGANIZATION_CONTACT_ROLE];

export const DEFAULT_ORGANIZATION_CONTACT_ROLES: Array<{
  value: string;
  order: number;
  isSystem?: boolean;
}> = [
  { value: 'Sales', order: 1, isSystem: true },
  { value: 'Purchasing', order: 2, isSystem: true },
  { value: 'Billing', order: 3, isSystem: true },
  { value: 'Delivery', order: 4, isSystem: true },
];

export enum ContactEntityType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
  ORGANIZATION = 'organization',
  OPPORTUNITY = 'opportunity',
}

export const CONTACT_ENTITY_TYPE = ContactEntityType;
