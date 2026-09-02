---
id: api-rate-limiting
title: "Rate Limiting & Throttling"
description: "Rate limit tiers, sliding window throttling, HTTP 429 response headers, and exponential backoff strategies."
category: "Developer"
order: 2
resource: "developers"
action: "read"
routes:
  - "/admin/developers"
tags: ["rate-limiting", "throttling", "429", "backoff", "api", "security", "developers"]
---

# Rate Limiting

The HeroBM API enforces rate limiting across public and authenticated endpoints to protect system stability and prevent denial-of-service or brute-force attacks.

---

## Rate Limit Tiers

Rate limits are evaluated using a rolling 60-second sliding window based on the client IP address or authenticated API key identity:

| Endpoint / Context | Rate Limit | Purpose |
| :--- | :--- | :--- |
| **Authentication (`POST /auth/login`)** | `5 requests / minute` | Brute-force credential protection |
| **User Profile (`GET /auth/me`)** | `30 requests / minute` | Session validation throttling |
| **Health Checks (`GET /health`)** | `120 requests / minute` | Infrastructure monitoring |
| **Standard API Endpoints (Default)** | `120 requests / minute` | General REST CRUD protection |
| **High-Throughput API Keys** | Up to `1,000 requests / minute` | Configurable in Developer Settings for bulk syncs |

---

## Rate Limit Response Headers & HTTP 429

When rate limits are approached or exceeded, the API provides standard diagnostic headers:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
```

### Response Body

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## Handling 429 Errors with Exponential Backoff

Clients should inspect the `Retry-After` header and implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
      const waitTime = retryAfter * 1000 || Math.pow(2, i) * 1000;
      console.warn(`Rate limited. Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return res;
  }
  throw new Error('Max retries exceeded');
}
```
