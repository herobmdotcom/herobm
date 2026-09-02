---
id: tech-engineering-standards
title: "Engineering Standards, QA & Immune System"
description: "Quality assurance standards: 5-Tier Verification testing hierarchy, Continuous Improvement protocol, AST structural tests, and Makefile orchestration."
category: "Architecture & Engineering"
order: 4
resource: "system"
action: "read"
tags: ["testing", "qa", "continuous-improvement", "advisories", "ast", "invariants", "makefile", "standards"]
---

# Engineering Standards, QA & Immune System

HeroBM adheres to strict quality assurance gates and an automated "Immune System" architecture to prevent convention drift and ensure regression resilience.

---

## 1. The 5-Tier Verification Hierarchy

HeroBM balances rapid developer iteration with comprehensive regression testing across five tiers:

| Tier | Name | Latency | Scope & Command |
| :--- | :--- | :--- | :--- |
| **Tier 0** | Dev Inner Loop | Sub-second to 5s | `make check-types`, `make check-lint`, `make test-single TEST=<file>` |
| **Tier 1** | Fast Verification Gate | < 25s | `make verify-fast` (Types, linting, in-memory unit tests, schema drift, dependency checks) |
| **Tier 2** | Subsystem Gates | 30s to 60s | `make verify-api` (PostgreSQL transactional tests) & `make verify-portal` (Next.js build) |
| **Tier 3** | Pre-Push & CI Release | 2 to 3m | `make pre-push` / GitHub Actions CI (AST structural invariants, full monorepo build) |
| **Tier 4** | Heavy Regression | 5 to 10m | `make test-heavy` (Full container stack, email/webhook relays, Playwright browser suites) |

---

## 2. Continuous Improvement & Immune System Protocol

Bugs, security issues, and architectural drift are treated as system infections under the CI Protocol:

```
[Issue Identified] ──► [Advisory Filed (.agents/workflows/advisory-resolution.md)]
                                 │
                                 ▼
                     [Tactical Fix Implemented]
                                 │
                                 ▼
                     [AST Structural Test Added] (infra/tests/test_adv_*.ts)
                                 │
                                 ▼
                     [Documentation Updated & Verified]
```

### Invariant Testing with TypeScript AST (`ts-morph`)
Whenever a structural bug or boundary violation is resolved, an automated AST test is added to `infra/tests/` to prevent recurrence across all workspaces.

---

## 3. Observability & Logging Standards

- **Structured JSON Logs**: Applications emit formatted JSON logs directly to the container daemon with automatic 20MB file rotation.
- **Audit Event Trail**: All database mutations emit structured audit events capturing actor, entity ID, action, and payload diffs.
- **Health Diagnostics**: Real-time status endpoints (`/health`) verify database connectivity, Redis responsiveness, and worker queue health.

---

## 4. Canonical Makefile Command Reference

All build, test, and infrastructure tasks are orchestrated via Makefile targets:

- `make fast-install`: Bootstrap dependencies, environment variables, database containers, and system seeds.
- `make verify-fast`: Mandatory task verification gate (runs types, lint, unit tests, schema drift).
- `make dev-db-generate NAME=<name>`: Generate a linear, tracked Drizzle schema migration.
- `make migrate`: Execute all pending PostgreSQL migrations.
- `make test-api-unit` / `make test-portal-unit`: Fast workspace unit tests.
- `make test-single TEST=<name>`: Run a specific test suite or AST structural test.
