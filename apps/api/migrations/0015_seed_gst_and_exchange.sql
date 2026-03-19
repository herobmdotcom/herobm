-- Seed GST categories
INSERT INTO modbm_core.gst_categories (code, title, type, rate, is_default) VALUES
  ('EXE', 'Exempt Customer', 'exempt', 0, false),
  ('ZR',  'Zero Rated Products', 'zero_rated', 0, false),
  ('GST', '9% GST', 'gst_applies', 9, true)
ON CONFLICT (code) DO NOTHING;

-- Seed Exchange Rates
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
  ('SAR', 'Saudi Riyal',         4.050000, 4.050000)
ON CONFLICT (currency_code) DO NOTHING;
