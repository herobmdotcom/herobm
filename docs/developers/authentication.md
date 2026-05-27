# Authentication

The ModBM API uses API Keys to authenticate external requests. API keys should be treated like passwords and kept secure.

## Obtaining an API Key

You can generate an API key in the ModBM Operations Portal:

1. Navigate to **Admin > Developers**.
2. Click **+ Create Key**.
3. Copy the generated `secretKey`. 

> [!WARNING]
> Your secret key will only be shown to you **once**. Make sure to save it in a secure password manager or environment variable. If you lose it, you will need to revoke the key and generate a new one.

## Using the API Key

To authenticate, provide your API key in the `x-api-key` header of your HTTP requests.

### Example (cURL)

```bash
curl -X GET "https://api.yourdomain.com/api/sales-orders" \
  -H "x-api-key: sk_test_1234abcd5678efgh..."
```

### Example (Node.js/fetch)

```javascript
const response = await fetch('https://api.yourdomain.com/api/sales-orders', {
  headers: {
    'x-api-key': 'sk_test_1234abcd5678efgh...'
  }
});
const data = await response.json();
```

## Security Best Practices

- **Never** embed your API key in client-side code (e.g. React/Next.js frontend applications). Always make requests from your backend server.
- **Never** commit your API key to source control (Git). Use environment variables.
- If you suspect an API key has been compromised, revoke it immediately in the Developer Settings.
