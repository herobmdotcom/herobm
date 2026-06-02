import * as crypto from 'crypto';

export interface HeroEvent<T = any> {
  eventId: string;
  eventType: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  payload: T;
}

type Handler<T = any> = (event: HeroEvent<T>) => Promise<void> | void;

export class WebhookReceiver {
  private secret: string;
  private handlers: Map<string, Handler[]> = new Map();

  constructor(config: { secret: string }) {
    this.secret = config.secret;
  }

  /**
   * Register a handler for a specific event type.
   */
  public on<T = any>(eventType: string, handler: Handler<T>) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Verifies the HMAC signature of the incoming webhook payload.
   * `payload` MUST be the raw unparsed string or Buffer from the HTTP request.
   */
  public verifySignature(rawPayload: string | Buffer, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(rawPayload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Express middleware that automatically verifies the signature and dispatches the event.
   * 
   * CRITICAL: You must use `express.raw({ type: 'application/json' })` before this middleware
   * so that `req.body` is a raw Buffer representing the exact HTTP payload.
   */
  public expressMiddleware() {
    return async (req: any, res: any) => {
      try {
        const signature = req.headers['x-modbm-signature'];
        if (!signature || typeof signature !== 'string') {
          return res.status(401).json({ error: 'Missing or invalid signature header' });
        }

        if (!Buffer.isBuffer(req.body)) {
          console.warn('[HeroBM] Webhook error: req.body is not a Buffer. Make sure to use express.raw({ type: "application/json" })');
          return res.status(500).json({ error: 'Server misconfiguration. Expected raw buffer body.' });
        }

        if (!this.verifySignature(req.body, signature)) {
          return res.status(401).json({ error: 'Signature verification failed' });
        }

        const bodyStr = req.body.toString('utf8');
        const parsedEvent = JSON.parse(bodyStr) as HeroEvent;

        if (!parsedEvent.eventType) {
           return res.status(400).json({ error: 'Missing eventType' });
        }

        const registeredHandlers = this.handlers.get(parsedEvent.eventType) || [];
        const wildcardHandlers = this.handlers.get('*') || [];
        const allHandlers = [...registeredHandlers, ...wildcardHandlers];

        // Process handlers concurrently
        await Promise.all(allHandlers.map(h => h(parsedEvent)));

        return res.status(200).json({ received: true });
      } catch (err: any) {
        console.error('Webhook processing error:', err.message || err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    };
  }
}

