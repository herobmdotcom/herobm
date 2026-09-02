<div align="center">

# HeroBM

**Modern, Real-Time Business Management & Operations Platform**

[Website](https://herobm.com) • [Documentation](https://herobm.com) • [Terms](https://herobm.com/terms) • [Security](SECURITY.md)

</div>

---

## Overview

**HeroBM** is an integrated business management platform (ERP / MRP / CRM / General Ledger) built for modern high-velocity operations. It connects sales, warehouse logistics, purchasing, manufacturing, CRM, and accounting into a single real-time transactional system.

For full product information, enterprise editions, and hosted options, visit [herobm.com](https://herobm.com).

---

## Key Capabilities

- **Unified CRM & Actor Architecture:** Single foundation for customers, suppliers, and contacts with unified history, financial terms, and credit control.
- **Perpetual Warehouse & Inventory Management:** Spatial topography (Locations $\rightarrow$ Zones $\rightarrow$ Bins), batch tracking, barcode scan-to-dispatch, quarantine, and real-time inventory ledger.
- **Order-to-Cash & Procure-to-Pay:** Sales orders, over-the-counter POS, quotes, shipments, returns, credit notes, purchase orders, goods receipt matching, and vendor debit notes.
- **Manufacturing & Work Orders:** Bills of materials (BOM), multi-stage work order tracking, component allocation, and finished goods putaway.
- **Real-Time Double-Entry Accounting:** Automated general ledger postings, strict subledger immutability, multidimensional reporting (Cost Centers, Activities), bank reconciliations, and fiscal period hard locks.
- **High-Performance PDF Engine:** Typst-powered template rendering for invoices, picking slips, statements, and shipment documents.
- **AI-Native Model Context Protocol (MCP):** Built-in MCP server providing secure tool calling and deep operational context to AI coding and automation agents.

---

## Architecture & Tech Stack

```
                       ┌─────────────────────────┐
                       │  Ops Portal (Next.js 15)│
                       │    Tailwind / ag-Grid   │
                       └────────────┬────────────┘
                                    │ (HTTP/REST)
                       ┌────────────▼────────────┐
 ┌──────────────┐      │      API Gateway        │      ┌─────────────────┐
 │  AI Agents   ├─────►│     (NestJS 11)         │◄─────┤ Outbox Worker   │
 │ (MCP Server) │      │   Casbin DAS / Drizzle  │      │ (BullMQ/Pino)   │
 └──────────────┘      └────────────┬────────────┘      └─────────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │       PostgreSQL        │
                       │   (Drizzle Schema/ORM)  │
                       └─────────────────────────┘
```

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router, Server Components & Client Hydration), [Tailwind CSS](https://tailwindcss.com/), [ag-Grid](https://www.ag-grid.com/), [Lucide Icons](https://lucide.dev/)
- **Backend API:** [NestJS 11](https://nestjs.com/), [Drizzle ORM](https://orm.drizzle.team/), [Casbin](https://casbin.org/) RBAC/ABAC authorization, [Passport JWT](https://www.passportjs.org/)
- **Database:** [PostgreSQL 16](https://www.postgresql.org/), [PGlite](https://pglite.dev/) (in-memory WASM testing), strict foreign keys, immutable compliance triggers
- **Worker & Async:** BullMQ, Redis, PostgreSQL transactional outbox relay with `LISTEN`/`NOTIFY`
- **Tooling & Monorepo:** [Turborepo](https://turbo.build/), TypeScript 5, GNU Make

---

## Monorepo Layout

```
├── apps/
│   ├── api/             # NestJS core REST API & domain services
│   ├── ops-portal/      # Next.js 15 operations web portal
│   ├── worker/          # Transactional outbox & event processing worker
│   └── mcp-server/      # Model Context Protocol (MCP) server for AI agents
├── packages/
│   ├── db-schema/       # Canonical Drizzle database schema definitions
│   ├── shared/          # Shared domain types, enums, math utilities, constants
│   └── sdk/             # Generated TypeScript API client SDK
├── infra/               # Structural architecture, security, and invariant tests
├── configs/             # Nginx, PostgreSQL, and runtime configs
└── scripts/             # Infrastructure and cross-platform setup scripts
```

---

## Quickstart

### Prerequisites

- Node.js $\ge 20$
- Python $\ge 3.11$
- Container runtime ([Docker Desktop](https://www.docker.com/) or [Podman](https://podman.io/))
- GNU Make

### 1. Installation & Environment Setup

```bash
# Clone the repository
git clone https://github.com/herobmdotcom/herobm.git
cd herobm

# Automated installation for your OS
make fast-install

# Or manual dependency install & env initialization
npm install
make init-env
```

### 2. Start Services & Database

```bash
# Start PostgreSQL, Redis, and supporting containers
make up

# Apply database migrations
make migrate

# Seed database with initial demo data
make seed-demo
```

### 3. Run Development Stack

```bash
# Start hot-reloading dev environment (API + Ops Portal)
make dev-local
```

Access the applications:
- **Ops Portal UI:** [http://localhost:8000](http://localhost:8000)
- **API Swagger / Docs:** [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

---

## Quality Gates & Testing

HeroBM enforces a multi-tier testing and verification hierarchy:

```bash
# Tier 1: Fast task gate (< 25s) — Types, linting, unit tests, schema drift
make verify-fast

# Tier 2: Structural architecture & security invariant tests
make test-structural

# Tier 3: Production portal build
make build-portal

# Tier 4: Unit tests across all workspaces
make test-unit
```

---

## Security

For vulnerability disclosures and security policies, please refer to [SECURITY.md](SECURITY.md) or contact **support@herobm.com**.

---

## License & Terms

Usage of this software is subject to terms and licensing details available at [herobm.com/terms](https://herobm.com/terms).
