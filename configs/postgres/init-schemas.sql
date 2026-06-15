-- ============================================
-- HeroBM Platform — Postgres Init Script
-- ============================================
-- Runs automatically on first container boot via
-- /docker-entrypoint-initdb.d/
--
-- Creates ALL schemas required by the platform.
-- The 'public' schema exists by default (Drizzle ORM target).
-- ============================================

-- Phase 1 ELT landing schema (created dynamically by dlt into raw_abm)

-- Suppress 'schema already exists' notices to keep logs clean
SET client_min_messages = warning;

-- Application schema (orders, users, events — managed by Drizzle ORM generation)
-- Drizzle automatically generates CREATE SCHEMA "herobm_core"; in the baseline migration.

-- dbt schemas (staging views + mart tables — managed by dbt)
-- DBT automatically creates required schemas on first run based on dbt_project.yml configuration.
