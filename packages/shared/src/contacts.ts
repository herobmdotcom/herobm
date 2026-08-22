export const ACTOR_CONTACT_ROLE = {
  SALES: 'sales',
  PURCHASING: 'purchasing',
  BILLING: 'billing',
  DELIVERY: 'delivery',
} as const;

export type ActorContactRole =
  (typeof ACTOR_CONTACT_ROLE)[keyof typeof ACTOR_CONTACT_ROLE];

export const DEFAULT_ACTOR_CONTACT_ROLES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Sales', order: 1 },
  { value: 'Purchasing', order: 2 },
  { value: 'Billing', order: 3 },
  { value: 'Delivery', order: 4 },
];
