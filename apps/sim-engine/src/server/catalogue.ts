export const EventType = {
  CUSTOMER_ENQUIRY: 'CUSTOMER_ENQUIRY',
  CUSTOMER_ONBOARDING: 'CUSTOMER_ONBOARDING',
  CUSTOMER_ORDER: 'CUSTOMER_ORDER',
  CUSTOMER_RETURN: 'CUSTOMER_RETURN',
  AUTHORITY_TAX_REQUEST: 'AUTHORITY_TAX_REQUEST',
  SUPPLIER_PAYMENT_REQUEST: 'SUPPLIER_PAYMENT_REQUEST',
  SUPPLIER_SHIPMENT_ARRIVAL: 'SUPPLIER_SHIPMENT_ARRIVAL',
  BANK_STATEMENT_AVAILABLE: 'BANK_STATEMENT_AVAILABLE'
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export interface SimEvent {
  id: string;
  type: EventType;
  timestamp: number; // Unix timestamp in ms
  targetAgentRole?: string; // If specific, otherwise all agents review
  payload: any;
  status: 'pending' | 'completed';
}

// Basic definitions for random generation
export const EVENT_CATALOGUE: Record<string, any> = {
  [EventType.CUSTOMER_ENQUIRY]: {
    weight: 10,
    generatePayload: () => ({ productId: 'PRD-1', quantity: Math.floor(Math.random() * 100) + 1 })
  },
  [EventType.CUSTOMER_ORDER]: {
    weight: 5,
    generatePayload: () => ({ productId: 'PRD-1', quantity: Math.floor(Math.random() * 50) + 1 })
  },
  [EventType.CUSTOMER_RETURN]: {
    weight: 2,
    generatePayload: () => ({ reason: 'Defective', isFullOrder: Math.random() > 0.8 })
  }
};
