# @herobm/sdk

This package contains the auto-generated TypeScript SDK for the HeroBM API.

The SDK is generated using [Orval](https://orval.dev/) from the OpenAPI specification produced by the `apps/api` NestJS backend.

## Generation

Do **not** edit the generated code in `src/` directly. Instead, modify the controllers and DTOs in `apps/api`, add proper Swagger decorators (`@ApiProperty()`, `@ApiOkResponse()`, etc.), and then regenerate the SDK.

To regenerate the SDK from the root of the monorepo:

```bash
make dev-generate-sdk
```

This command will:
1. Build the API project.
2. Run the `generate-openapi.js` script to output `openapi.json`.
3. Run Orval to generate the strictly-typed Axios client in `packages/sdk/src`.

## Usage

In the Next.js frontend (`apps/ops-portal`), the SDK is imported and configured via the `@herobm/sdk` alias.

### Configuration
The Axios instance must be configured with the base URL and authentication tokens. This is usually done in the layout or initialization phase of the app:

```typescript
import { axiosInstance } from '@herobm/sdk';

axiosInstance.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

axiosInstance.interceptors.request.use((config) => {
  // Add auth token from session/cookies
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Making Requests

Simply import the SDK methods. They map directly to the API controllers and are strictly typed.

```typescript
import * as api from '@herobm/sdk';

// Automatically typed Request & Response DTOs
const res = await api.productsControllerFindAll();
setProducts(res.data); // res.data is properly typed as ProductResponseDto[]

const newProduct = await api.productsControllerCreate({ name: 'New Item', code: 'ITM-01' });
```

## Strict Typings Policy

**No `any` casting is allowed.** 

The Continuous Improvement pipeline (`test_fe_no_api_any_casting.ps1`) enforces that frontend code never uses `as any` or `: any` when interacting with the API SDK. 

If you find that an endpoint returns `unknown` or lacks specific property types:
1. Go to the corresponding controller in `apps/api`.
2. Ensure you have properly annotated the endpoint using `@ApiOkResponse({ type: MyResponseDto })`.
3. Ensure all properties in `MyResponseDto` have `@ApiProperty()` decorators.
4. Run `make dev-generate-sdk` to fix the types at the source.
