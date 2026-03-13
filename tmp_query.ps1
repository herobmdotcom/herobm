# Load .env
$envFile = Join-Path $PSScriptRoot ".env"
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
    $parts = $line -split '=', 2
    if ($parts.Length -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$user = $env:POSTGRES_USER
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "custom_app" }

$query = @"
-- 1. Overall counts
SELECT
  count(*) AS total_products,
  count(free_stock) AS free_stock_populated,
  count(*) - count(free_stock) AS free_stock_null,
  count(*) FILTER (WHERE qty_on_hand > 0) AS has_stock,
  count(*) FILTER (WHERE qty_on_hand > 0 AND free_stock IS NULL) AS has_stock_but_null_free
FROM raw_abm.products;

-- 2. Products with stock on hand but NULL free_stock (the problematic ones)
SELECT
  trim(product_code) AS product_code,
  trim(product_title) AS product_name,
  qty_on_hand,
  free_stock,
  cust_orders,
  reserved_stock,
  (qty_on_hand - coalesce(cust_orders,0) - coalesce(reserved_stock,0)) AS calc_available
FROM raw_abm.products
WHERE qty_on_hand > 0
  AND free_stock IS NULL
ORDER BY qty_on_hand DESC
LIMIT 20;

-- 3. Products where free_stock disagrees with the calculated value
SELECT
  count(*) AS disagreements,
  sum(qty_on_hand) AS total_oh_affected
FROM raw_abm.products
WHERE free_stock IS NOT NULL
  AND qty_on_hand > 0
  AND abs(free_stock - (qty_on_hand - coalesce(cust_orders,0) - coalesce(reserved_stock,0))) > 0.01;
"@

docker exec postgres-custom psql -U $user -d $db -c $query
