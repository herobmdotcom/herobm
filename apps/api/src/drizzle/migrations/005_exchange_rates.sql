-- 005_exchange_rates.sql
-- Static exchange rates table.
-- Rates are expressed as: units of foreign currency per 1 EUR (home currency).
-- Will be made updatable in the future.

BEGIN;

CREATE TABLE modbm_core.exchange_rates (
  exchange_rate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code text NOT NULL UNIQUE,
  currency_name text NOT NULL,
  buy_rate numeric NOT NULL,
  sell_rate numeric NOT NULL,
  effective_date timestamptz DEFAULT now(),
  updated_on timestamptz DEFAULT now()
);

-- Seed with current approximate rates (EUR as base = 1.000000)
INSERT INTO modbm_core.exchange_rates (currency_code, currency_name, buy_rate, sell_rate) VALUES
  ('EUR', 'Euro',                1.000000, 1.000000),
  ('USD', 'US Dollar',           1.080000, 1.080000),
  ('CAD', 'Canadian Dollar',     1.470000, 1.470000),
  ('GBP', 'British Pound',       0.860000, 0.860000),
  ('DKK', 'Danish Krone',        7.460000, 7.460000),
  ('SEK', 'Swedish Krona',       11.20000, 11.20000),
  ('MYR', 'Malaysian Ringgit',   5.080000, 5.080000),
  ('AUD', 'Australian Dollar',   1.660000, 1.660000),
  ('IDR', 'Indonesian Rupiah',   16900.00, 16900.00),
  ('NZD', 'New Zealand Dollar',  1.800000, 1.800000),
  ('SGD', 'Singapore Dollar',    1.450000, 1.450000),
  ('JPY', 'Japanese Yen',        162.0000, 162.0000),
  ('KRW', 'South Korean Won',    1430.000, 1430.000),
  ('LKR', 'Sri Lankan Rupee',    325.0000, 325.0000),
  ('ZAR', 'South African Rand',  20.10000, 20.10000),
  ('SAR', 'Saudi Riyal',         4.050000, 4.050000);

COMMIT;
