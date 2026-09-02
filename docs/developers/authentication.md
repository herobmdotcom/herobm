# Authentication

The HeroBM API supports dual authentication mechanisms: **API Keys** for backend integrations and automated scripts, and **JWT Bearer Tokens** for interactive user sessions.

---

## 1. API Key Authentication (Machine-to-Machine)

API keys are generated via 32 bytes of cryptographically secure random entropy (`randomBytes(32).toString('hex')`) resulting in a 64-character hexadecimal token.

### Generating an API Key

1. Log in to the Operations Portal with administrator privileges.
2. Navigate to **Administration** → **Developers** (`/admin/developers`).
3. Click **+ Add Key**, enter a descriptive name, and assign a role (e.g. `admin`, `agent`, `operator`).
4. Copy the generated secret key.

> [!WARNING]
> Your secret key will only be shown to you **once** in the Secret Modal. The database stores only a salted bcrypt hash (cost 10). If you lose the key, you must revoke it and generate a new one.

### Supplying the API Key

Provide your API key in the `x-api-key` HTTP header (or as `Authorization: Bearer <hex_key>`):

#### Example (cURL)

```bash
curl -X GET "https://api.yourdomain.com/api/sales-orders" \
  -H "x-api-key: 4f8b9e2c1a7d6e5f3b8a0c2d4e6f8a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f" \
  -H "Accept: application/json"
```

#### Example (Node.js / fetch)

```javascript
const response = await fetch('https://api.yourdomain.com/api/sales-orders', {
  headers: {
    'x-api-key': process.env.HEROBM_API_KEY,
    'Accept': 'application/json'
  }
});
const data = await response.json();
```

---

## 2. JWT Bearer Token Authentication (User Sessions)

When logging in via `/auth/login` (`POST`), the API returns a short-lived JSON Web Token (JWT). Supply this token in the `Authorization` header:

```bash
curl -X GET "https://api.yourdomain.com/api/auth/me" \
  -H "Authorization: Bearer <jwt_access_token>"
```

---

## Security Best Practices

- **Never embed API keys in client-side applications**: Client-side single-page apps (SPAs) expose headers in the browser network inspector. Always proxy external requests through your backend server.
- **Rotate keys regularly**: Revoke unused or compromised keys under **Admin** → **Developers**.
- **Role Scoping**: Assign the least privileged role required for the integration.
