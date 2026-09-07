---
id: tech-platform-framework
title: "Application Framework & Security"
description: "Application architecture: NestJS backend layer, Casbin RBAC security model, Next.js UI patterns, and Dynamic Typst PDF reports."
category: "Architecture & Engineering"
order: 3
resource: "system"
action: "read"
routes:
  - "/admin/users"
  - "/admin/developers"
  - "/reports"
tags: ["nestjs", "casbin", "rbac", "nextjs", "react", "ui", "typst", "reporting", "framework"]
---

# Application Framework & Security

HeroBM pairs a modular NestJS API with a high-density Next.js web application and a metadata-driven Typst PDF generation engine.

---

## 1. NestJS API Architecture (`apps/api/`)

The API layer exposes a typed, RESTful HTTP interface:

- **DTOs as Classes**: All Request/Response DTOs are declared as TypeScript classes decorated with `class-validator` (e.g. `@IsString()`, `@IsUUID()`, `@IsPercentage()`). This enables reflection and runtime schema validation.
- **Pass-the-TX Pattern**: All multi-write and dependent read service methods accept an optional `tx?: DrizzleDB` parameter, guaranteeing ACID transaction propagation across service boundaries.
- **Unified Exception Filtering**: Unhandled database constraint violations (unique, foreign key, check constraints) are mapped to standard HTTP 400/409/422 status codes via `AllExceptionsFilter`.
- **Standardized Pagination**: List endpoints implement `PaginationQuery` (`?q=&page=&limit=`) returning `{ data, page, limit, total }`.

---

## 2. Casbin RBAC Security Architecture

Authorization is centralized via a Casbin-powered Data Access Service (DAS):

```
HTTP Request ──► JwtAuthGuard (Validates Bearer Token / API Key)
                     │
                     ▼
             CasbinGuard (Queries Casbin Enforcer)
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
[@CasbinResource('sales-orders')]   [@CasbinAction('read'|'write')]
```

### Security Directives
1. **No UI-Only AuthZ**: Role permissions are evaluated strictly on the backend via NestJS guards. UI elements render conditionally based on server-evaluated permissions.
2. **Deny-by-Default Policy**: Endpoints without explicit Casbin policies default to deny unless tagged with `@SkipCasbin()` (restricted to public health and auth endpoints).
3. **Audit Identity**: System audit logs record the authenticated username (`req.user.username`) rather than raw subject tokens.

---

## 3. Ops Portal UI Architecture (`apps/ops-portal/`)

The Ops Portal is built with Next.js 15, React, and Tailwind CSS adhering to the "Machine Shop" design identity:

- **Dense Industrial Layout**: Optimized for high-throughput operational productivity (`p-2`, `gap-2`, compact typography).
- **ag-Grid Enterprise Grids**: Standardized for master data tables with server-side filtering, sorting, column reordering, and CSV export.
- **Client-Side Data Fetching**: Standardized wrappers (`apiFetch`, `apiMutate`, `apiFetchBlob`) manage authentication headers and JSON serialization.
- **Strict Internationalization (`next-intl`)**: All UI strings are managed through `messages/en.json` using `t('key')` to maintain type-safe localization.

---

## 4. Dynamic Reporting & Typst PDF Engine

The reporting subsystem decouples report intents (e.g. "Print Shipping Docket") from specific formatting templates:

- **Template Registry**: Typst templates (`.typ`) are stored in the `herobm_core.reports` database table with context mappings in `report_contexts`.
- **Typst CLI Compilation**: The API compiles Typst templates dynamically using JSON data payloads, producing vector PDFs in sub-second rendering times.
- **Zero-Code Report Deployment**: System administrators can upload, test, and activate custom company report layouts directly through the UI without requiring backend rebuilds.
