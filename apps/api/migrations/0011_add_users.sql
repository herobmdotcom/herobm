-- 0011_add_users.sql
-- Application users for portal auth + RBAC
-- Passwords are seeded using environment variables via psql \set
-- Run: make migrate

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS modbm_core.users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial users with hashed passwords.
-- The migrate.py script substitutes env vars before execution.
-- Passwords come from .env: DEV_ADMIN_PASSWORD, DEV_SALES_PASSWORD, etc.
INSERT INTO modbm_core.users (username, password_hash, role) VALUES
    ('admin',       crypt(:'DEV_ADMIN_PASSWORD',       gen_salt('bf')), 'admin'),
    ('sales',       crypt(:'DEV_SALES_PASSWORD',       gen_salt('bf')), 'sales'),
    ('warehouse',   crypt(:'DEV_WAREHOUSE_PASSWORD',   gen_salt('bf')), 'warehouse'),
    ('procurement', crypt(:'DEV_PROCUREMENT_PASSWORD', gen_salt('bf')), 'procurement')
ON CONFLICT (username) DO NOTHING;
