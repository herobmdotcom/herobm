$file = "c:\Users\Marcel\volz\modbm\modbm\apps\api\src\orders\orders-write.service.ts"
$content = [System.IO.File]::ReadAllText($file)

# 1. Replace the import of sharedWriteEvent with emitEvent imports
$content = $content -replace "import \{`n  writeEvent as sharedWriteEvent,`n  findOrderLine as sharedFindOrderLine,`n\} from '\./shipment-helpers';", "import {`n  findOrderLine as sharedFindOrderLine,`n} from './shipment-helpers';`nimport { emitEvent } from '../common/emit-event';`nimport { AggregateType } from '../common/event-types';"

# Also handle \r\n
$content = $content -replace "import \{`r`n  writeEvent as sharedWriteEvent,`r`n  findOrderLine as sharedFindOrderLine,`r`n\} from '\./shipment-helpers';", "import {`r`n  findOrderLine as sharedFindOrderLine,`r`n} from './shipment-helpers';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';"

# 2. Remove the private writeEvent method (both line ending types)
$content = $content -replace "(?s)  /\*\*\r?\n   \* Write an audit event and outbox record in the same transaction scope\.\r?\n   \*/\r?\n  private async writeEvent\(\r?\n    tx: any,\r?\n    salesOrderId: string,\r?\n    eventType: string,\r?\n    payload: any,\r?\n    actor: string,\r?\n  \): Promise<void> \{\r?\n    await sharedWriteEvent\(tx, salesOrderId, eventType, payload, actor\);\r?\n  \}\r?\n", ""

# 3. Replace all this.writeEvent(tx, id, type, payload, actor) with emitEvent
# Pattern: await this.writeEvent(\n        tx,\n        id,\n        'type',\n        payload,\n        actor,\n      );
$content = $content -replace "await this\.writeEvent\(\r?\n\s+tx,\r?\n\s+([^,]+),\r?\n\s+'([^']+)',\r?\n\s+(\{[^}]*\}),\r?\n\s+([^,]+),\r?\n\s+\);", "await emitEvent(tx, {`n          aggregateType: AggregateType.SALES_ORDER,`n          aggregateId: `$1,`n          eventType: '`$2',`n          payload: `$3,`n          actor: `$4,`n        });"

[System.IO.File]::WriteAllText($file, $content)
Write-Host "Done"
