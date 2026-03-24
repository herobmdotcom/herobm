# Technical Guide: Dynamic Report Engine

**Status**: Implemented
**Engine**: Typst (CLI)
**Architecture Pattern**: Intent-based "Hook" Registry

## Executive Summary
This guide details the architecture of the Metadata-Driven Report Engine. The core system decouples "Intents" (e.g., printing an invoice) from "Implementations" (the specific Typst template used). 

By storing templates in the `modbm_core` database (`reports` table) and utilizing a many-to-many context mapping (`report_contexts`), the system enables administrators to create, test, and deploy arbitrary reports for any entity without requiring API deployments or source code changes.

## Key Architectural Pillars

### 1. The Hook Model (Intents & Dynamic Resolvers)
Standard system actions like `sales-order-quote` are treated as "Hooks." The UI calls the hook, and the API resolves which specific Typst template is currently assigned to that hook via `report_hook_assignments`.

To prevent the reporting engine from becoming tightly coupled to specific domains, the engine uses an **Inversion of Control (IoC) Registry Pattern** (`ReportsRegistry`). External modules (e.g., `OrdersModule`) dynamically register their data-fetching resolvers with the `ReportsModule` at boot time (`onModuleInit`). 

### 2. Authorization (Casbin DAS Integration)
In strict adherence to the project Constitution, returning a PDF requires both authentication and localized authorization. The `/hooks/:hookSlug/run` endpoint requires standard JWT Auth and Casbin permissions for the `report` resource. Furthermore, the domain-specific data resolvers securely fetch data using the user's context to ensure entity-level permission checks.

### 3. Execution Engine & Resource Management
Typst serves as the rendering engine via **Subprocess CLI** execution. The API spawns a child process (`execAsync`) to call the `typst compile` CLI. 
Critically, to prevent container storage exhaustion, the service wraps execution in a strict `try/finally` block that forcefully cleans up the temporary `.typ`, `.json`, and `.pdf` files from the local disk immediately after rendering completes or fails.

### 4. Continuous Observability
PDF rendering is computationally heavy. The execution pipeline is actively instrumented via logging, recording compilation duration and payload length. Failed Typst compilations stream explicit Typst `stderr` dumps directly to the logs, allowing developers to debug syntax errors and missing variables.

### 5. Testing & Verification Strategy
Following the "Shift-Left Testing" mandate, the Dynamic Report Engine is validated via an End-to-End Pipeline test (`reports.e2e-spec.ts`). The test dynamically requests a seeded hook, evaluates real domain test data, and asserts that the final rendered binary structures rigorously begin with the `%PDF-` magic bytes.
