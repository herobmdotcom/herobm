$patterns = @(
    '\.insert\(orderEvents\)',
    '\.insert\(purchaseOrderEvents\)',
    '\.insert\(productEvents\)',
    '\.insert\(accountEvents\)',
    '\.insert\(supplierEvents\)',
    '\.insert\(productSupplierEvents\)',
    '\.insert\(outbox\)'
)

$output = @()
foreach ($p in $patterns) {
    $output += "=== $p ==="
    $results = Get-ChildItem -Path "c:\Users\Marcel\volz\modbm\modbm\apps\api\src" -Filter "*.ts" -Recurse | Select-String -Pattern $p
    foreach ($r in $results) {
        $output += ($r.Filename + ':' + $r.LineNumber + ': ' + $r.Line.Trim())
    }
    $output += ""
}

$output | Out-File -FilePath "c:\Users\Marcel\volz\modbm\modbm\all_event_inserts.txt" -Encoding utf8
