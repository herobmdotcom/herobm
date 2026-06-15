# Rate Limiting

The HeroBM API enforces rate limiting to ensure system stability and fair usage across all consumers. 

Rate limits are applied dynamically based on the authentication context. 

## Default Limits

1. **Browser/Session Requests**: `60 requests / minute`
2. **API Key Requests**: `1000 requests / minute` (Configurable by Administrators)

Administrators can increase or decrease the API Key limit via the **Admin > Developers** section in the Operations Portal.

## Exceeding the Limits

If you exceed the rate limit, the API will reject subsequent requests and return a standard `429 Too Many Requests` HTTP response code. 

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## Handling 429 Errors

It is strongly recommended to implement exponential backoff and retry logic in your API clients to gracefully handle rate limit exceptions during high-throughput operations (e.g. bulk data syncs).

### Example Retry Logic (JavaScript)

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    
    if (res.status === 429) {
      const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s...
      console.warn(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    
    return res;
  }
  throw new Error('Max retries exceeded');
}
```
