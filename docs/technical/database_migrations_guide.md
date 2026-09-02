# Database Schema & Migrations Guide

The `herobm_core` database uses [Drizzle ORM](https://orm.drizzle.team/) as its source-of-truth for schema definitions. This document outlines the rules for managing schema changes, handling custom Postgres logic, and maintaining migration journal integrity.

---

## 1. Drizzle is a Strict Sequential Ledger

Drizzle handles data definition (DDL) using a strictly ordered ledger. When you run `make dev-db-generate NAME=<migration_name>`, it compares your TypeScript schemas (`packages/db-schema/src/*.schema.ts`) against the internal JSON snapshot in `apps/api/migrations/meta/` and emits the differences into a numerically prefixed `.sql` file (e.g., `0021_add_status.sql`).

**Golden Rules of DDL Migrations:**
1. **Meaningful Naming is Mandatory:** You **must** provide a descriptive, human-readable name using the `NAME` parameter:
   ```bash
   make dev-db-generate NAME=add_customer_tax_code
   ```
2. **Never manually rename generated `.sql` files.** Drizzle stores the filename in `meta/_journal.json` and in the snapshot JSON. Manually renaming files breaks Drizzle's internal snapshot ledger. If you generate a migration with an incorrect name, drop it cleanly using `npx drizzle-kit drop` and re-generate.
3. **Never modify the generated DDL.** If Drizzle generates a `CREATE TABLE` statement, do not manually wrap it in a `DO $$` or add `IF NOT EXISTS`. Drizzle strictly assumes its generated code applies exactly once to any fresh database.
4. **Never allow duplicate prefixes.** If a branch merge results in two files with the same prefix (e.g., `0007_feature_a.sql` and `0007_feature_b.sql`), the Drizzle snapshot ledger is instantly corrupted. Our structural test suite (`make test-structural`) actively verifies `meta/_journal.json` sequence integrity.

---

## 2. Handling Custom Logic (Views, Triggers, Functions)

Drizzle `generate` **only** tracks standard tables, columns, constraints, and indexes. It does not automatically author custom Postgres procedural functions or triggers.

### The `extensions.sql` Pattern
All custom database logic (immutability triggers, fiscal period locks, and audit functions) is permanently housed in `apps/api/src/drizzle/extensions.sql`.

- **Idempotency is Mandatory:** Everything in `extensions.sql` is evaluated continuously during migrations:
  - `CREATE OR REPLACE VIEW...`
  - `CREATE OR REPLACE FUNCTION...`
  - `DROP TRIGGER IF EXISTS trg ON tbl; CREATE TRIGGER trg...`
- **Data Seeding:** Do not put `INSERT` statements into `extensions.sql`. Data backfills and base seeds should be run via the TypeScript seed runner: `make seed` (`apps/api/src/seeds/run.ts`).

### Custom SQL Migrations & TTY Errors
If you must write custom SQL that executes exactly once (like a complex data migration accompanying a schema drop), **never manually create an untracked file in the `migrations` folder.**

**The Correct Workflow:**
1. Run `npx drizzle-kit generate --custom --name your_migration_name`.
2. This safely allocates the next sequential prefix, creates an empty `.sql` file, and records it in `meta/_journal.json`.
3. Open the generated file and write your custom SQL.

---

## 3. Applying Migrations & Verification

- Apply pending migrations:
  ```bash
  make dev-db-migrate
  ```
- Run structural test verification:
  ```bash
  make test-structural
  ```
