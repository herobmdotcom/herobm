import * as crypto from 'crypto';
import { getErrorMessage } from '@modbm/shared';

type Handler = (payload: any) => Promise<void> | void;

export class WebhookReceiver {
  private secret: string;
  private handlers: Map<string, Handler[]> = new Map();

  constructor(config: { secret: string }) {
    this.secret = config.secret;
  }

  /**
   * Register a handler for a specific event type.
   */
  public on(eventType: string, handler: Handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Verifies the HMAC signature of the incoming webhook payload.
   */
  public verifySignature(payloadString: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Express middleware that automatically verifies the signature and dispatches the event.
   * Expects `express.json()` to have been used before this middleware if you want to rely on req.body,
   * but to verify the raw payload we technically need the raw string.
   * Assuming `req.body` is parsed and we stringify it.
   */
  public expressMiddleware() {
    return async (req: any, res: any) => {
      try {
        const signature = req.headers['x-modbm-signature'];
        if (!signature || typeof signature !== 'string') {
          return res.status(401).json({ error: 'Missing or invalid signature header' });
        }

        // Ideally, this should use raw body, but for simplicity we'll stringify req.body
        const payloadString = JSON.stringify(req.body);

        if (!this.verifySignature(payloadString, signature)) {
          return res.status(401).json({ error: 'Signature verification failed' });
        }

        const { eventId, type, payload } = req.body;

        if (!type) {
           return res.status(400).json({ error: 'Missing event type' });
        }

        const registeredHandlers = this.handlers.get(type) || [];
        // Support wildcard handlers
        const wildcardHandlers = this.handlers.get('*') || [];

        const allHandlers = [...registeredHandlers, ...wildcardHandlers];

        // Process handlers concurrently
        await Promise.all(allHandlers.map(h => h(payload)));

        return res.status(200).json({ received: true });
      } catch (err: unknown) {
        console.error('Webhook processing error:', getErrorMessage(err));
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    };
  }
}
