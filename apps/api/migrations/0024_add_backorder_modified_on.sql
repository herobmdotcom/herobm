-- Add modified_on column to backorders table
ALTER TABLE modbm_core.backorders ADD COLUMN modified_on timestamp with time zone DEFAULT now();
