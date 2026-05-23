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

-- Application schema (orders, users, events — managed by tools/migrate.py)
CREATE SCHEMA IF NOT EXISTS modbm_core;

-- dbt schemas (staging views + mart tables — managed by dbt)
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS public_marts;
