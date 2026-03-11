SELECT 
    t.name AS TableName,
    c.name AS ColumnName
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
WHERE c.name IN (
    'CustomerID', 'SupplierID', 'ProductID', 'JobID', 'CompanyID', 
    'TransactionID', 'AccountID', 'BranchID', 'LineItemID', 'CostCentreNo', 'ProjectNo', 'ContactID'
)
ORDER BY c.name, t.name;
