# Webhooks

Webhooks allow you to build custom integrations that react to events in ModBM as they happen, rather than continuously polling the API for updates.

When an event occurs in ModBM, the system will execute an HTTP POST payload to the webhook's configured target URL.

## Configuration

To create a webhook:

1. Navigate to **Admin > Developers** in the portal.
2. Click **+ Add Webhook**.
3. Specify the **Target URL** (the endpoint on your server that will receive the payloads).
4. Specify the **Events** you want to subscribe to (e.g. `order.created`, `invoice.paid`).

## Payload Format

The POST request will contain a JSON body with the event details:

```json
{
  "eventId": "uuid-v4",
  "eventType": "order.created",
  "payload": {
    "salesOrderId": "...",
    "customer": "..."
  },
  "occurredAt": "2026-05-27T10:00:00Z"
}
```

## Security: Verifying Webhook Signatures

To ensure that the webhook was actually sent by ModBM (and not a malicious third party), every webhook request includes a cryptographic signature in the `x-modbm-signature` header.

The signature is generated using a HMAC with SHA-256 algorithm.

### Verification Steps

1. Get your webhook's **Secret Key** from the Developers page.
2. Read the raw, unparsed string body of the incoming HTTP request.
3. Compute the HMAC-SHA256 hash using the Secret Key and the raw body.
4. Compare your computed hash to the `x-modbm-signature` header.

### Example (Node.js / Express)

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

const WEBHOOK_SECRET = process.env.MODBM_WEBHOOK_SECRET;

// You must use raw body parsing to correctly compute the hash
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-modbm-signature'];
  const body = req.body.toString(); // raw string

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // Signature is valid! Parse JSON and process event.
  const event = JSON.parse(body);
  console.log(`Received event: ${event.eventType}`);

  res.status(200).send('OK');
});
```

## Retries

If your server responds with a non-2xx status code (e.g. 500 Internal Server Error) or times out, ModBM will mark the webhook dispatch as failed. Currently, failed webhooks are not automatically retried but can be inspected by administrators. Ensure your webhook endpoint responds quickly (e.g., within 3 seconds) and defers heavy processing to a background worker.
