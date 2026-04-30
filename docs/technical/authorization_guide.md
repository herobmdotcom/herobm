# Authorization & Security Guide (Casbin RBAC)

This document details the authorization architecture of the Composable ERP. Authentication (AuthN) proves *who* a user is via JWT, while Authorization (AuthZ) dictates *what* they can do. 

We use **Casbin** as our centralized Data Access Service (DAS) to enforce Role-Based Access Control (RBAC) across the platform.

---

## 1. The Casbin Model

The authorization schema is defined in `apps/api/src/auth/casbin/model.conf`. It relies on a standard RBAC architecture:
* **Subject (`sub`)**: The user's role (e.g., `sales`, `warehouse`).
* **Object (`obj`)**: The domain resource being accessed (e.g., `sales-orders`, `products`).
* **Action (`act`)**: The operation being performed (e.g., `read`, `write`, `archive`).
* **Role Inheritance (`g`)**: Allows roles to inherit permissions from base roles.

## 2. The Policy Matrix (`policy.csv`)

The exact permissions matrix is maintained in `apps/api/src/auth/casbin/policy.csv`.

### The Base Role: `viewer`
Every authenticated user in the system automatically inherits the `viewer` role (`g, [role], viewer`). 
The `viewer` role grants `read` access to almost all operational data (accounts, products, inventory, orders, dashboards). **Transparency is preferred over silos in operations.**

### Write-Enabled Roles
Write access is explicitly granted to specialized roles based on their operational domain:

| Role | Inherits | Primary Write Capabilities |
|------|----------|----------------------------|
| **`admin`** | `viewer` | **Full access.** Can read/write/archive all resources, execute system setup, read system logs, and manage users. |
| **`finance`** | `viewer` | Read/write General Ledger (`gl`), write Sales & Purchase Orders (for invoicing workflows). |
| **`sales`** | `viewer` | Write Accounts (CRM) and Sales Orders. |
| **`warehouse`**| `viewer` | Write Sales Orders (picking/shipping), Purchase Orders, and Receptions (goods receipt). |
| **`procurement`**| `viewer` | Write Suppliers and Purchase Orders. |
| **`system`** | - | Bootstrap/utility role. Restricted solely to `/api/setup` execution. |

---

## 3. Backend Enforcement (NestJS)

The API strictly enforces these policies via decorators and global guards. No data logic is executed unless the Casbin Guard approves the request.

### Decorator Usage
Every controller must explicitly declare the resource it guards using `@CasbinResource` and each route must declare the action using `@CasbinAction`.

```typescript
@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class SalesOrdersController {
  
  @Get()
  @CasbinAction('read')
  findAll() { ... }

  @Patch(':id/state')
  @CasbinAction('write')
  changeState() { ... }
  
  @Post(':id/archive')
  @CasbinAction('archive') // Explicitly restricted action
  archive() { ... }
}
```

### The CasbinGuard
The `CasbinGuard` intercepts every request:
1. Extracts the user's role from the JWT payload.
2. Extracts the requested resource and action from the route metadata.
3. Queries the in-memory Casbin Enforcer: `enforcer.enforce(role, resource, action)`.
4. Returns `403 Forbidden` if denied.

---

## 4. Frontend Enforcement (Next.js)

The `ops-portal` frontend is "dumb" regarding security—it never makes authoritative access decisions. However, it provides a graceful UX by hiding or disabling UI elements the user is not permitted to use.

### The `useAuth` Hook
The frontend parses the active JWT to determine the user's role via the `AuthContext`.

```tsx
import { useAuth } from '@/components/AuthGate';

export function OrderDetailPanel() {
  const { role } = useAuth();
  
  // Gracefully hide the Ship button if the user isn't admin/warehouse
  const canShip = role === 'admin' || role === 'warehouse';

  return (
    <div>
      {/* ... data read logic ... */}
      {canShip && <Button onClick={shipOrder}>Ship Order</Button>}
    </div>
  );
}
```

*Note: In the future, this UI evaluation may be upgraded to dynamically query the API's Casbin definitions rather than hardcoding role names in the frontend, preventing UI/API drift.*

---

## 5. Modifying Policies

1. **Changing Permissions**: Modify `apps/api/src/auth/casbin/policy.csv`. Restart the API service, as Casbin policies are loaded into memory on startup.
2. **Adding Resources**: Ensure both the controller uses `@CasbinResource('new-resource')` and the `policy.csv` is updated to grant access. Without a policy line, default access is `deny`.
