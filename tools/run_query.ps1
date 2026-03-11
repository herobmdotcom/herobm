$server = "localhost"
$database = "mpgtrial"
$username = "sa"
$password = 'P$^1uiuaqQCQh0' 

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
