export const CRM_ACTIVITY_TYPE = {
  CALL: 'call',
  MEETING: 'meeting',
  EMAIL: 'email',
  TASK: 'task',
  NOTE: 'note',
} as const;

export type CrmActivityType =
  (typeof CRM_ACTIVITY_TYPE)[keyof typeof CRM_ACTIVITY_TYPE];

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
  ACTOR = 'actor',
  CONTACT = 'contact',
  OPPORTUNITY = 'opportunity',
}

export const CRM_ENTITY_TYPE = CrmEntityType;

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
