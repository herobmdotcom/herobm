# Load credentials from .env file (never hardcode passwords)
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    Write-Error "FATAL: .env file not found at $envFile. Copy .env.example to .env and fill in credentials."
    exit 1
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+)\s*$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

$server = $env:ABM_MSSQL_HOST
$database = $env:ABM_MSSQL_DATABASE
$username = $env:ABM_MSSQL_USER
$password = $env:ABM_MSSQL_PASSWORD

if (-not $server -or -not $password) {
    Write-Error "FATAL: ABM_MSSQL_HOST and ABM_MSSQL_PASSWORD must be set in .env"
    exit 1
}

$connectionString = "Server=$server;Database=$database;User Id=$username;Password=$password;TrustServerCertificate=True"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()

    $query = "SELECT t.name AS TableName, i.rows AS RowCounts FROM sys.tables t INNER JOIN sys.sysindexes i ON t.object_id = i.id AND i.indid < 2 WHERE i.rows > 0 ORDER BY i.rows DESC;"
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $command
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    $dataset.Tables[0] | Export-Csv -Path "mpgtrial_populated_tables.csv" -NoTypeInformation -Encoding UTF8
    Write-Host "Results safely saved to mpgtrial_populated_tables.csv"

    $connection.Close()
} catch {
    Write-Error "Failed to connect or query: $_"
}
