ALTER TABLE herobm_core.tax_positions DROP COLUMN IF EXISTS is_default;
ALTER TABLE herobm_core.tax_positions DROP COLUMN IF EXISTS is_default_customer;
ALTER TABLE herobm_core.tax_positions DROP COLUMN IF EXISTS is_default_supplier;
ALTER TABLE herobm_core.trading_terms DROP COLUMN IF EXISTS is_default;
ALTER TABLE herobm_core.trading_terms DROP COLUMN IF EXISTS is_default_customer;
ALTER TABLE herobm_core.trading_terms DROP COLUMN IF EXISTS is_default_supplier;

ALTER TABLE herobm_core.app_settings ADD COLUMN IF NOT EXISTS default_customer_terms_id uuid REFERENCES herobm_core.trading_terms(trading_terms_id);
ALTER TABLE herobm_core.app_settings ADD COLUMN IF NOT EXISTS default_supplier_terms_id uuid REFERENCES herobm_core.trading_terms(trading_terms_id);
ALTER TABLE herobm_core.app_settings ADD COLUMN IF NOT EXISTS default_customer_tax_position_id uuid REFERENCES herobm_core.tax_positions(tax_position_id);
ALTER TABLE herobm_core.app_settings ADD COLUMN IF NOT EXISTS default_supplier_tax_position_id uuid REFERENCES herobm_core.tax_positions(tax_position_id);

-- Migrate old default_trading_terms_id if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='default_trading_terms_id') THEN
        UPDATE herobm_core.app_settings SET default_customer_terms_id = default_trading_terms_id;
        ALTER TABLE herobm_core.app_settings DROP COLUMN default_trading_terms_id;
    END IF;
END $$;
