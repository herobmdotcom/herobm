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

    $query = @"
DECLARE @TableName NVARCHAR(256);
DECLARE @DateColumnName NVARCHAR(256);
DECLARE @Sql NVARCHAR(MAX);

CREATE TABLE #TableStats (
    TableName NVARCHAR(256),
    DateColumnUsed NVARCHAR(256),
    TotalRows INT,
    MinDate DATETIME,
    MaxDate DATETIME,
    DaysSpan INT,
    EstimatedDailyWrites DECIMAL(10,2)
);

DECLARE TableCursor CURSOR FOR
SELECT t.name
FROM sys.tables t
INNER JOIN sys.sysindexes i ON t.object_id = i.id AND i.indid < 2
WHERE i.rows > 0 AND t.is_ms_shipped = 0;

OPEN TableCursor;
FETCH NEXT FROM TableCursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @DateColumnName = NULL;
    
    -- Priority 1: CreatedDate or similar
    SELECT TOP 1 @DateColumnName = c.name
    FROM sys.columns c
    INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.object_id = OBJECT_ID(@TableName)
      AND ty.name IN ('datetime', 'date', 'datetime2', 'smalldatetime')
      AND c.name IN ('CreatedDate', 'EnteredDate', 'ModifiedDate', 'TransDate', 'TransactionDate', 'DateEntered', 'DateCreated')
    ORDER BY 
        CASE c.name 
            WHEN 'CreatedDate' THEN 1
            WHEN 'DateCreated' THEN 2
            WHEN 'EnteredDate' THEN 3
            WHEN 'DateEntered' THEN 4
            WHEN 'TransDate' THEN 5
            WHEN 'TransactionDate' THEN 6
            WHEN 'ModifiedDate' THEN 7
            ELSE 8 
        END;

    -- Priority 2: Any datetime column
    IF @DateColumnName IS NULL
    BEGIN
        SELECT TOP 1 @DateColumnName = c.name
        FROM sys.columns c
        INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        WHERE c.object_id = OBJECT_ID(@TableName)
          AND ty.name IN ('datetime', 'date', 'datetime2', 'smalldatetime');
    END

    IF @DateColumnName IS NOT NULL
    BEGIN
        -- Safe dynamic SQL
        SET @Sql = N'
        INSERT INTO #TableStats (TableName, DateColumnUsed, TotalRows, MinDate, MaxDate, DaysSpan, EstimatedDailyWrites)
        SELECT 
            @PTableName,
            @PDateColumnName,
            COUNT(*),
            MIN([' + @DateColumnName + ']),
            MAX([' + @DateColumnName + ']),
            DATEDIFF(day, MIN([' + @DateColumnName + ']), MAX([' + @DateColumnName + '])),
            CASE 
                WHEN DATEDIFF(day, MIN([' + @DateColumnName + ']), MAX([' + @DateColumnName + '])) > 0 
                THEN CAST(COUNT(*) AS DECIMAL(10,2)) / DATEDIFF(day, MIN([' + @DateColumnName + ']), MAX([' + @DateColumnName + ']))
                ELSE NULL
            END
        FROM [' + @TableName + '];
        ';
        
        BEGIN TRY
            EXEC sp_executesql @Sql, 
                               N'@PTableName NVARCHAR(256), @PDateColumnName NVARCHAR(256)', 
                               @TableName, @DateColumnName;
        END TRY
        BEGIN CATCH
            -- If calculation fails, just insert the row count
            INSERT INTO #TableStats (TableName, DateColumnUsed, TotalRows)
            SELECT @TableName, 'ERROR_CALCULATING', i.rows
            FROM sys.sysindexes i WHERE i.id = OBJECT_ID(@TableName) AND i.indid < 2;
        END CATCH
    END
    ELSE
    BEGIN
        -- No date column
        INSERT INTO #TableStats (TableName, DateColumnUsed, TotalRows)
        SELECT @TableName, 'NO_DATE_COLUMN', i.rows
        FROM sys.sysindexes i WHERE i.id = OBJECT_ID(@TableName) AND i.indid < 2;
    END

    FETCH NEXT FROM TableCursor INTO @TableName;
END

CLOSE TableCursor;
DEALLOCATE TableCursor;

SELECT * FROM #TableStats ORDER BY EstimatedDailyWrites DESC, TotalRows DESC;
DROP TABLE #TableStats;
"@

    $command = $connection.CreateCommand()
    $command.CommandText = $query
    $command.CommandTimeout = 120
    
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $command
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    $dataset.Tables[0] | Export-Csv -Path "mpgtrial_daily_writes.csv" -NoTypeInformation -Encoding UTF8
    Write-Host "Results safely saved to mpgtrial_daily_writes.csv"

    $connection.Close()
} catch {
    Write-Error "Failed to connect or query: $_"
}
