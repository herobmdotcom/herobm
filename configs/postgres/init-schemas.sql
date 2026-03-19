-- ============================================
-- Antigravity Platform — Postgres Init Script
-- ============================================
-- Runs automatically on first container boot via
-- /docker-entrypoint-initdb.d/
--
-- Creates ALL schemas required by the platform.
-- The 'public' schema exists by default (Drizzle ORM target).
-- ============================================

-- Phase 1 ELT landing schema (dlt raw loads from ABM)
CREATE SCHEMA IF NOT EXISTS raw_evaluationau;

-- Application schema (orders, users, events — managed by tools/migrate.py)
CREATE SCHEMA IF NOT EXISTS modbm_core;

-- dbt schemas (staging views + mart tables — managed by dbt)
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS public_marts;
