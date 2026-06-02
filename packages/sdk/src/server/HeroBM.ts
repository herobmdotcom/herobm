import { WebhookReceiver, HeroEvent } from './WebhookReceiver';

export interface HeroBMConfig {
  apiKey?: string;
  baseUrl?: string;
  webhookSecret?: string;
}

export class HeroBM {
  private apiKey?: string;
  private baseUrl: string;
  public webhooks: WebhookReceiver;

  constructor(config: HeroBMConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'http://localhost:3001';
    
    // Initialize the webhook receiver internally
    this.webhooks = new WebhookReceiver({ secret: config.webhookSecret || '' });
  }

  public events = {
    /**
     * Listen to an incoming webhook event.
     */
    on: <T = any>(eventType: string, handler: (event: HeroEvent<T>) => Promise<void> | void) => {
      this.webhooks.on(eventType, handler);
    },

    /**
     * Publishes an event to the backend message queue (via outbox).
     */
    publish: async (type: string, payload: any) => {
      if (!this.apiKey) {
        throw new Error('API Key is required to publish events.');
      }
      const response = await fetch(`${this.baseUrl}/api/events/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ type, payload })
      });

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const body = await response.json();
          if (body.message) errorMsg = body.message;
        } catch(e) {}
        throw new Error(`Failed to publish event: ${response.status} ${errorMsg}`);
      }

      return response.json();
    }
  };
}
