export class HeroBM {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'http://localhost:3001'; // Default to local API for development
  }

  public events = {
    /**
     * Publishes an event to the backend message queue (via outbox).
     */
    publish: async (type: string, payload: any) => {
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
