# Database Schema & Migrations Guide

The `modbm_core` database uses [Drizzle ORM](https://orm.drizzle.team/) as its source-of-truth for schema definitions. This document outlines the absolute rules for managing schema changes, handling custom Postgres logic, and squashing schemas safely.

## 1. Drizzle is a Strict Sequential Ledger

Drizzle handles data definition (DDL) using a strictly ordered ledger. When you run `npx drizzle-kit generate`, it compares your TypeScript schema (`apps/api/src/drizzle/*-schema.ts`) against an internal JSON snapshot in `apps/api/migrations/meta/` and emits the differences into a numerically prefixed `.sql` file (e.g., `0021_add_status.sql`).

**Golden Rules of DDL Migrations:**
1. **Never rename the generated `.sql` files.** `tools/migrate.py` applies files in alphabetical order.
2. **Never modify the generated DDL.** If Drizzle generates a `CREATE TABLE` statement, do not manually wrap it in a `DO $$` or add `IF NOT EXISTS`. Drizzle strictly assumes its generated code applies exactly once to any fresh database. If you manually tweak Drizzle's output to make it "idempotent," you mask deeper sequencing errors.
3. **Never allow duplicate prefixes.** If a branch merge results in two files with the same prefix (e.g., `0007_feature_a.sql` and `0007_feature_b.sql`), the Drizzle snapshot ledger is instantly corrupted. You must consolidate these files manually or request a team squash. Our infrastructure suite (`make test-structural-local`) actively prevents duplicate prefixes from entering `main`.

## 2. Handling Custom Logic (Views, Triggers, Functions)

Drizzle `generate` **only** tracks standard tables, columns, constraints, and indexes. It natively deletes or ignores custom Postgres functions if it isn't strictly defined in its schema configuration layer.

If you embed custom logic (like `CREATE TRIGGER` or `CREATE OR REPLACE VIEW`) directly into a generated Drizzle migration file (e.g., appending it at the bottom of `0021_add_status.sql`), **it will be permanently lost** the next time the team squashes the migration history into a baseline.

### The `extensions.sql` Pattern
All custom database logic must be permanently housed in `apps/api/src/drizzle/extensions.sql`.

- **Idempotency is Mandatory:** Everything in `extensions.sql` is evaluated continuously at the end of every `tools/migrate.py` run. Therefore, you must use idempotent syntax:
  - `CREATE OR REPLACE VIEW...`
  - `CREATE OR REPLACE FUNCTION...`
  - `DROP TRIGGER IF EXISTS trg ON tbl; CREATE TRIGGER trg...`
- **Data Seeding:** Do not put `INSERT` statements into `extensions.sql`. Temporary inserts or data backfills should be run via Python scripts (`tools/seed.py`).

## 3. Squashing Migrations into a Baseline

As the project evolves, the `apps/api/migrations/` folder gets noisy. When it reaches ~20-30 incremental files, the team should execute a squash. A squash eliminates sequential alter-table overhead, resetting the database to a single optimized command script per table.

**How to Execute a Squash:**
1. Clear external logic by ensuring all custom triggers/views from the historical sequence are securely tracked in `extensions.sql`.
2. Delete all `*.sql` files inside `apps/api/migrations/`.
3. Delete the `apps/api/migrations/meta/` directory.
4. Run `npx drizzle-kit generate` to let Drizzle parse your TS schema and produce a massive, clean `0000_something.sql`.
5. Rename that cleanly generated file to `0000_baseline.sql`.

> [!WARNING]
> Following a squash, the central SQL timeline has severed all ties to the past. Because historical files like `0015_add_column.sql` no longer exist, any developer whose local Postgres container applied them previously will experience an immediate sync failure.
> 
> **Resolution:** When the `main` branch undergoes a squash, all developers must execute `make nuke` to destroy their local database volume, followed immediately by `make setup` to reconstruct their environments using the precise new `0000_baseline.sql`.
