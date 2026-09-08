export const CRM_ACTIVITY_TYPE = {
  CALL: 'call',
  MEETING: 'meeting',
  EMAIL: 'email',
  TASK: 'task',
  NOTE: 'note',
} as const;

export type CrmActivityType =
  | (typeof CRM_ACTIVITY_TYPE)[keyof typeof CRM_ACTIVITY_TYPE]
  | (string & {});

export const CRM_ACTIVITY_STATUS = {
  OPEN: 'open',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  SCHEDULED: 'scheduled',
} as const;

export type CrmActivityStatus =
  (typeof CRM_ACTIVITY_STATUS)[keyof typeof CRM_ACTIVITY_STATUS];

export const CRM_ACTIVITY_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type CrmActivityPriority =
  (typeof CRM_ACTIVITY_PRIORITY)[keyof typeof CRM_ACTIVITY_PRIORITY];

export enum CrmEntityType {
  ORGANIZATION = 'organization',
  CONTACT = 'contact',
  OPPORTUNITY = 'opportunity',
}

export const CRM_ENTITY_TYPE = CrmEntityType;

export const DEFAULT_CRM_ACTIVITY_TYPES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'call', order: 1 },
  { value: 'meeting', order: 2 },
  { value: 'email', order: 3 },
  { value: 'task', order: 4 },
  { value: 'note', order: 5 },
];

export const DEFAULT_OPPORTUNITY_STAGES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Prospect', order: 1 },
  { value: 'Qualification', order: 2 },
  { value: 'Proposal', order: 3 },
  { value: 'Negotiation', order: 4 },
  { value: 'Won', order: 5 },
  { value: 'Lost', order: 6 },
];

export const DEFAULT_OPPORTUNITY_TYPES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Commercial', order: 1 },
  { value: 'Infrastructure', order: 2 },
  { value: 'Supply Agreement', order: 3 },
  { value: 'Services / Consulting', order: 4 },
];

export const DEFAULT_OPPORTUNITY_CONTACT_ROLES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Decision Maker', order: 1 },
  { value: 'Procurement Lead', order: 2 },
  { value: 'Project Manager', order: 3 },
  { value: 'Technical Director', order: 4 },
  { value: 'Operations Director', order: 5 },
  { value: 'Primary Stakeholder', order: 6 },
  { value: 'Lead Estimator', order: 7 },
];

export const DEFAULT_OPPORTUNITY_ORGANIZATION_ROLES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'General Contractor', order: 1 },
  { value: 'Primary Builder', order: 2 },
  { value: 'Procurement Partner', order: 3 },
  { value: 'Supplier Consortium Partner', order: 4 },
  { value: 'Prime Contractor', order: 5 },
  { value: 'EPC Contractor', order: 6 },
  { value: 'Preferred Tool Supplier', order: 7 },
  { value: 'Maintenance Contractor', order: 8 },
  { value: 'Bidder', order: 9 },
];

export const DEFAULT_ORGANIZATION_TAGS: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Key Account', order: 1 },
  { value: 'High Growth', order: 2 },
  { value: 'Enterprise', order: 3 },
  { value: 'Government', order: 4 },
  { value: 'Strategic Partner', order: 5 },
];

export const DEFAULT_REFERRAL_MODES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Word of Mouth', order: 1 },
  { value: 'Partner Referral', order: 2 },
  { value: 'Existing Customer', order: 3 },
  { value: 'Website / Inbound', order: 4 },
  { value: 'Trade Show / Event', order: 5 },
];
