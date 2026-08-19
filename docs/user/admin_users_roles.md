---
id: admin-users
title: "Users, Roles & Permissions"
description: "Manage operator accounts, role assignments, and granular Casbin RBAC access control policies."
category: "Administration"
order: 29
resource: "users"
action: "read"
routes:
  - "/admin/users"
  - "/admin/users/roles"
tags: ["users", "roles", "rbac", "permissions", "security", "access-control", "admin"]
fields:
  username:
    title: "Username"
    summary: "Unique login handle for the operator."
  email:
    title: "Email Address"
    summary: "Contact email for notifications and password recovery."
  role_name:
    title: "Assigned Role"
    summary: "System role (e.g. Administrator, Sales Manager, Warehouse Staff, Accountant, Read-Only)."
  is_active:
    title: "Account Status"
    summary: "Active or Suspended status preventing login."
related:
  - "admin-settings"
  - "technical-operations"
---

# Users, Roles & Permissions

The **Users & Roles** module manages operator accounts, authentication security, and granular Role-Based Access Control (RBAC) powered by Casbin.

---

## Access Control Model (RBAC)

```mermaid
flowchart LR
    User[User Account] -->|Assigned To| Role[Role e.g. Warehouse]
    Role -->|Enforces| Policy[Casbin Policy Matrix]
    Policy -->|Grants Permissions| Res[Resource & Action e.g. orders:read, inventory:write]
```

### 1. Standard Predefined Roles
- **Administrator**: Unrestricted access across all modules, configuration, and developer tools.
- **Sales Representative**: Quotes, Sales Orders, Customer profiles, and Shipments.
- **Warehouse Operator**: Receiving, Putaway, Bin movements, Picking, and Shipping dispatch.
- **Finance / Accountant**: Invoices, Credit Notes, General Ledger, Balances, and Bank Reconciliations.
- **Read-Only Auditor**: Read-only inspection across all operational and financial records.

---

## Step-by-Step Workflows

### 1. Inviting a New User
1. Go to **Admin** → **Users** (`/admin/users`).
2. Click **+ Invite User**.
3. Enter the **Display Name**, **Email Address**, and **Username**.
4. Assign one or more **Roles** (e.g. Sales, Warehouse).
5. Click **Send Invitation**.

### 2. Modifying Role Permissions
1. Go to **Admin** → **Users** → **Roles & Permissions** (`/admin/users/roles`).
2. Select the target role.
3. Toggle permissions on the resource grid (Create, Read, Update, Delete per resource).
4. Click **Save Permissions**. Changes take effect immediately.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Username** | User login identity. |
| **Email** | Notifications and account email. |
| **Role** | Access tier determining permission policies. |
| **Resource** | System module (e.g. `orders`, `inventory`, `finance`). |
| **Action** | Allowed verb (`read`, `write`, `delete`, `admin`). |
