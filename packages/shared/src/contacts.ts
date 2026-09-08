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
}> = [
  { value: 'Sales', order: 1 },
  { value: 'Purchasing', order: 2 },
  { value: 'Billing', order: 3 },
  { value: 'Delivery', order: 4 },
];

export enum ContactEntityType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
  ORGANIZATION = 'organization',
  OPPORTUNITY = 'opportunity',
}

export const CONTACT_ENTITY_TYPE = ContactEntityType;
