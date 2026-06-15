import { WebhookReceiver, HeroEvent } from './WebhookReceiver';
import * as crypto from 'crypto';

describe('WebhookReceiver', () => {
  const SECRET = 'test_secret_key_123'; // TEST_CREDENTIAL
  let receiver: WebhookReceiver;

  beforeEach(() => {
    receiver = new WebhookReceiver({ secret: SECRET });
  });

  const generateSignature = (payload: string | Buffer) => {
    return crypto
      .createHmac('sha256', SECRET)
      .update(payload)
      .digest('hex');
  };

  describe('verifySignature', () => {
    it('should return true for a valid signature and raw string payload', () => {
      const payload = JSON.stringify({ hello: 'world' });
      const signature = generateSignature(payload);
      expect(receiver.verifySignature(payload, signature)).toBe(true);
    });

    it('should return true for a valid signature and Buffer payload', () => {
      const payload = Buffer.from(JSON.stringify({ hello: 'world' }));
      const signature = generateSignature(payload);
      expect(receiver.verifySignature(payload, signature)).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const payload = JSON.stringify({ hello: 'world' });
      expect(receiver.verifySignature(payload, 'invalid_signature')).toBe(false);
    });
  });

  describe('expressMiddleware', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        headers: {},
        body: null,
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should return 401 if x-herobm-signature header is missing', async () => {
      const middleware = receiver.expressMiddleware();
      await middleware(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing or invalid signature header' });
    });

    it('should return 500 if req.body is not a Buffer', async () => {
      mockReq.headers['x-herobm-signature'] = 'any_signature';
      mockReq.body = { parsed: 'json' }; // Not a buffer

      const middleware = receiver.expressMiddleware();
      await middleware(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Server misconfiguration. Expected raw buffer body.' });
    });

    it('should return 401 if signature verification fails', async () => {
      mockReq.headers['x-herobm-signature'] = 'wrong_signature';
      mockReq.body = Buffer.from(JSON.stringify({ hello: 'world' }));

      const middleware = receiver.expressMiddleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Signature verification failed' });
    });

    it('should return 400 if the payload is missing eventType', async () => {
      const invalidEvent = { eventId: '123' }; // missing eventType
      const rawPayload = Buffer.from(JSON.stringify(invalidEvent));
      
      mockReq.headers['x-herobm-signature'] = generateSignature(rawPayload);
      mockReq.body = rawPayload;

      const middleware = receiver.expressMiddleware();
      await middleware(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing eventType' });
    });

    it('should trigger registered handlers and return 200 on success', async () => {
      const validEvent: HeroEvent = {
        eventId: 'evt_123',
        eventType: 'sales_order.created',
        entityId: 'so_123',
        entityType: 'sales_order',
        timestamp: new Date().toISOString(),
        payload: { test: true }
      };
      
      const rawPayload = Buffer.from(JSON.stringify(validEvent));
      mockReq.headers['x-herobm-signature'] = generateSignature(rawPayload);
      mockReq.body = rawPayload;

      const handlerMock = jest.fn();
      const wildcardMock = jest.fn();
      
      receiver.on('sales_order.created', handlerMock);
      receiver.on('*', wildcardMock);

      const middleware = receiver.expressMiddleware();
      await middleware(mockReq, mockRes);

      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(handlerMock).toHaveBeenCalledWith(validEvent);
      
      expect(wildcardMock).toHaveBeenCalledTimes(1);
      expect(wildcardMock).toHaveBeenCalledWith(validEvent);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
