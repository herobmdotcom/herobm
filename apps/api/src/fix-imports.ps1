# Fix import paths: ../gst/tax-categories.service -> ../tax/tax-categories.service
$root = "C:\Users\Marcel\volz\modbm\modbm\apps\api\src"

$replacements = @(
    @{ From = "../gst/tax-categories.service"; To = "../tax/tax-categories.service" },
    @{ From = "../gst/tax.module"; To = "../tax/tax.module" }
)

$files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    ($_.Extension -eq ".ts") -and
    $_.FullName -notlike "*\node_modules\*" -and
    $_.FullName -notlike "*\dist\*"
}

$changedFiles = @()

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($null -eq $content -or $content -eq "") { continue }
    
    $original = $content
    
    foreach ($r in $replacements) {
        $content = $content.Replace($r.From, $r.To)
    }
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        $changedFiles += $file.FullName
    }
}

Write-Output "Changed $($changedFiles.Count) files:"
foreach ($f in $changedFiles) {
    Write-Output "  $f"
}
