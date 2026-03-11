-- ============================================
-- Antigravity Platform — Postgres Init Script
-- ============================================
-- Runs automatically on first container boot via
-- /docker-entrypoint-initdb.d/
--
-- Creates the schemas required by the platform.
-- The 'public' schema exists by default (Drizzle ORM target).
-- ============================================

-- Phase 1 ELT landing schema (dlt raw loads from ABM)
CREATE SCHEMA IF NOT EXISTS raw_evaluationau;
