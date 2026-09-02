# Authorization & Security Guide (Casbin RBAC)

This document details the authorization architecture of the HeroBM platform. Authentication (AuthN) proves *who* a user is via JWT or API Key, while Authorization (AuthZ) dictates *what* they can do.

HeroBM uses **Casbin** as its centralized authorization engine with a 4-tuple Deny-Override model backed by live PostgreSQL storage.

---

## 1. The Casbin 4-Tuple Model

The authorization model is defined in `apps/api/src/auth/casbin/model.conf`:
* **Subject (`sub`)**: The user or assigned role (e.g. `sales`, `warehouse`, `admin`).
* **Object (`obj`)**: The domain resource being accessed (e.g. `sales-orders`, `purchase-orders`, `inventory`, `gl`).
* **Action (`act`)**: The operation being performed (`read`, `write`, `archive`, `handle`, `invoice`, `delete`).
* **Effect (`eft`)**: Explicit authorization outcome (`allow` or `deny`).
* **Role Inheritance (`g`)**: Hierarchical role composition (`g, [role], [parent_role]`).
* **Policy Effect Rule**: Evaluates rules with **Deny-Override** logic (`some(where (p.eft == allow)) && !some(where (p.eft == deny))`).

---

## 2. Dynamic Database Policy Storage (`casbin_rules`)

Unlike static file-based systems, HeroBM stores Casbin policies directly in the PostgreSQL database table: `casbin_rules`.

* **Live Updates**: Administrators can modify role permissions dynamically from the web interface at **Administration** → **Users** → **Roles & Permissions** (`/admin/users/roles`).
* **Zero Restart**: Modifications take effect immediately across all active API instances without restarting servers.

---

## 3. Backend Controller Enforcement (NestJS)

Every NestJS controller declares its target resource and actions using decorators:

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
  @CasbinAction('archive')
  archive() { ... }
}
```

The `CasbinGuard` validates the authenticated user's role against the database policies, returning HTTP `403 Forbidden` if denied.

---

## 4. Standard System Resources

Standard resource identifiers are codified in `packages/shared/src/resources.ts`:
- `sales-orders`, `purchase-orders`, `purchase-returns`, `sales-returns`, `sales-invoices`, `sales-credit-notes`, `work-orders`, `inventory`, `gl`, `reports`, `fiscal-periods`, `crm`, `admin`, `system`.
