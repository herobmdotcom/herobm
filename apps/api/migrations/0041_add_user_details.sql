-- Add display_name and email to users table
ALTER TABLE modbm_core.users ADD COLUMN display_name TEXT;
ALTER TABLE modbm_core.users ADD COLUMN email TEXT;
