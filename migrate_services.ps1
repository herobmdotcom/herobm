# ========================================================================================
# Migrate all remaining services to emitEvent
# ========================================================================================

function Replace-InFile {
    param([string]$File, [string]$Find, [string]$Replace)
    $content = [System.IO.File]::ReadAllText($File)
    if ($content.Contains($Find)) {
        $content = $content.Replace($Find, $Replace)
        [System.IO.File]::WriteAllText($File, $content)
        Write-Host "  [OK] Replaced pattern in $([System.IO.Path]::GetFileName($File))"
    } else {
        Write-Host "  [SKIP] Pattern not found in $([System.IO.Path]::GetFileName($File))"
    }
}

$api = "c:\Users\Marcel\volz\modbm\modbm\apps\api\src"

# ── purchase-orders.service.ts ──────────────────────────────────────────────────────────
$f = "$api\purchase-orders\purchase-orders.service.ts"
Write-Host "`n=== purchase-orders.service.ts ==="

# Remove outbox import
Replace-InFile $f "  purchaseOrderEvents,`r`n  outbox," "  purchaseOrderEvents,"

# Add emitEvent import after audit import
Replace-InFile $f "import { calculateAuditTrail, AuditMode } from '../common/audit';" "import { calculateAuditTrail, AuditMode } from '../common/audit';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';"

# Remove OUTBOX_EVENT_TYPES and writeEvent method
$oldMethod = @"
  /** Event types that have active ERPNext mappers in the outbox-relay worker. */
  private static readonly OUTBOX_EVENT_TYPES = new Set([
    'goods_received',
    'goods_dispatched',
    'sales_invoiced',
    'purchase_invoiced',
  ]);

  private async writeEvent(
    tx: any,
    purchaseOrderId: string,
    eventType: string,
    payload: any,
    actor: string,
  ): Promise<void> {
    // Always write to the entity event table (audit log)
    await tx.insert(purchaseOrderEvents).values({
      purchaseOrderId,
      eventType,
      payload,
      actor,
    });

    // Only enqueue to the outbox if the worker has a mapper for this type
    if (PurchaseOrdersService.OUTBOX_EVENT_TYPES.has(eventType)) {
      await tx.insert(outbox).values({
        aggregateType: 'purchase_order',
        aggregateId: purchaseOrderId,
        eventType,
        payload,
      });
    }
  }
"@
Replace-InFile $f $oldMethod ""

# Now read file for regex-based replacements of this.writeEvent calls
$content = [System.IO.File]::ReadAllText($f)

# Pattern: await this.writeEvent(tx, orderId, 'type', { ... }, actor);
# We need to use regex for multi-line patterns
$content = [regex]::Replace($content, 
    'await this\.writeEvent\(\s*tx,\s*([^,]+),\s*''([^'']+)'',\s*(\{[^}]*\}),\s*actor,?\s*\);',
    'await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: $1,
        eventType: ''$2'',
        payload: $3,
        actor,
      });')

# Handle the simple one-liner: this.writeEvent(tx, orderId, 'line_removed', { lineId }, actor);
$content = $content.Replace(
    "await this.writeEvent(tx, orderId, 'line_removed', { lineId }, actor);",
    "await emitEvent(tx, { aggregateType: AggregateType.PURCHASE_ORDER, aggregateId: orderId, eventType: 'line_removed', payload: { lineId }, actor });")

[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] PO service migration complete"


# ── backorders.service.ts ───────────────────────────────────────────────────────────────
$f = "$api\orders\backorders.service.ts"
Write-Host "`n=== backorders.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

# Replace imports: add emitEvent, remove direct event table imports
$content = $content.Replace(
    "  purchaseOrderEvents,`r`n",
    "")
$content = $content.Replace(
    "  orderEvents,`r`n",
    "")

# Add emitEvent import
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Replace PO event insert
$content = [regex]::Replace($content,
    'await tx\.insert\(purchaseOrderEvents\)\.values\(\{([^}]+)\}\);',
    {
        param($m)
        $inner = $m.Groups[1].Value
        # Parse the fields
        if ($inner -match 'purchaseOrderId:\s*([^,]+),\s*eventType:\s*([^,]+),\s*payload:\s*([^,]+),\s*actor:\s*(.+)$') {
            return "await emitEvent(tx, { aggregateType: AggregateType.PURCHASE_ORDER, aggregateId: $($matches[1].Trim()), eventType: $($matches[2].Trim()), payload: $($matches[3].Trim()), actor: $($matches[4].Trim().TrimEnd(',')), });"
        }
        return $m.Value
    })

# Replace SO event insert  
$content = [regex]::Replace($content,
    'await tx\.insert\(orderEvents\)\.values\(\{([^}]+)\}\);',
    {
        param($m)
        $inner = $m.Groups[1].Value
        if ($inner -match 'salesOrderId:\s*([^,]+),\s*eventType:\s*([^,]+),\s*payload:\s*([^,]+),\s*actor:\s*(.+)$') {
            return "await emitEvent(tx, { aggregateType: AggregateType.SALES_ORDER, aggregateId: $($matches[1].Trim()), eventType: $($matches[2].Trim()), payload: $($matches[3].Trim()), actor: $($matches[4].Trim().TrimEnd(',')), });"
        }
        return $m.Value
    })

[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Backorders service migration complete"


# ── sales-invoice.service.ts ────────────────────────────────────────────────────────────
$f = "$api\invoices\sales-invoice.service.ts"
Write-Host "`n=== sales-invoice.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  orderEvents,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Replace the order_events insert (multiline)
$oldPattern = @"
    await tx.insert(orderEvents).values({
"@
# We need to find and replace the full block manually
$lines = $content -split "`r`n"
$newLines = @()
$skip = $false
$skipCount = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(orderEvents).values({') {
        # Find the closing });
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        # Write the emitEvent call
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.SALES_ORDER,"
        $newLines += "${indent}  aggregateId: $($fields['salesOrderId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) {
            $newLines += "${indent}  actor: $($fields['actor']),"
        }
        $newLines += "${indent}});"
        $i = $j  # skip past the closing });
        continue
    }
    
    # Also handle outbox inserts
    if ($lines[$i].Trim() -eq 'await tx.insert(outbox).values({') {
        $j = $i + 1
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') { $j++ }
        # Skip the entire outbox insert - emitEvent handles it
        $i = $j
        continue
    }
    
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"

# Remove outbox import if present
$content = $content.Replace("  outbox,`r`n", "")

[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Sales invoice service migration complete"


# ── purchase-invoice.service.ts ─────────────────────────────────────────────────────────
$f = "$api\invoices\purchase-invoice.service.ts"
Write-Host "`n=== purchase-invoice.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  purchaseOrderEvents,`r`n", "")
$content = $content.Replace("  outbox,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Same line-by-line replacement approach
$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(purchaseOrderEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.PURCHASE_ORDER,"
        $newLines += "${indent}  aggregateId: $($fields['purchaseOrderId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    if ($lines[$i].Trim() -eq 'await tx.insert(outbox).values({') {
        $j = $i + 1
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') { $j++ }
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Purchase invoice service migration complete"


# ── purchase-returns.service.ts ─────────────────────────────────────────────────────────
$f = "$api\purchase-orders\purchase-returns.service.ts"
Write-Host "`n=== purchase-returns.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  purchaseOrderEvents,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(purchaseOrderEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.PURCHASE_ORDER,"
        $newLines += "${indent}  aggregateId: $($fields['purchaseOrderId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Purchase returns service migration complete"


# ── receptions.service.ts ───────────────────────────────────────────────────────────────
$f = "$api\receptions\receptions.service.ts"
Write-Host "`n=== receptions.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  purchaseOrderEvents,`r`n", "")
$content = $content.Replace("  outbox,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(purchaseOrderEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.PURCHASE_ORDER,"
        $newLines += "${indent}  aggregateId: $($fields['purchaseOrderId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    if ($lines[$i].Trim() -eq 'await tx.insert(outbox).values({') {
        $j = $i + 1
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') { $j++ }
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Receptions service migration complete"


# ── returns-write.service.ts ────────────────────────────────────────────────────────────
$f = "$api\orders\returns-write.service.ts"
Write-Host "`n=== returns-write.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  orderEvents,`r`n", "")
$content = $content.Replace("  outbox,`r`n", "")
# Remove writeEvent import from shipment-helpers
$content = $content.Replace(
    "  writeEvent as sharedWriteEvent,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Remove private writeEvent method
$oldWriteEvent = @"
  private async writeEvent(
    tx: any,
    salesOrderId: string,
    eventType: string,
    payload: any,
    actor: string,
  ): Promise<void> {
    await sharedWriteEvent(tx, salesOrderId, eventType, payload, actor);
  }
"@
$content = $content.Replace($oldWriteEvent, "")

# Replace this.writeEvent calls
$content = [regex]::Replace($content,
    'await this\.writeEvent\(\s*tx,\s*([^,]+),\s*''([^'']+)'',\s*(\{[^}]*\}),\s*actor,?\s*\);',
    'await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: $1,
        eventType: ''$2'',
        payload: $3,
        actor,
      });')

# Replace direct outbox insert
$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -match '^await this\.db\.insert\(outbox\)\.values\(\{$' -or $lines[$i].Trim() -match '^await tx\.insert\(outbox\)\.values\(\{$') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $dbOrTx = if ($lines[$i] -match 'this\.db') { 'this.db' } else { 'tx' }
        $newLines += "${indent}await emitEvent($dbOrTx, {"
        $newLines += "${indent}  aggregateType: AggregateType.SALES_ORDER,"
        $newLines += "${indent}  aggregateId: $($fields['aggregateId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        $newLines += "${indent}  actor: actor,"
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Returns write service migration complete"


# ── gl.service.ts ───────────────────────────────────────────────────────────────────────
$f = "$api\gl\gl.service.ts"
Write-Host "`n=== gl.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  outbox,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -match '// Write .gl_posted. outbox event') {
        $newLines += $lines[$i]
        $i++ # skip to the actual insert
        if ($lines[$i].Trim() -eq 'await tx.insert(outbox).values({') {
            $j = $i + 1
            $fields = @{}
            while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
                $line = $lines[$j].Trim().TrimEnd(',')
                if ($line -match '^(\w+):\s*(.+)$') {
                    $fields[$matches[1]] = $matches[2]
                }
                $j++
            }
            $indent = $lines[$i] -replace '\S.*', ''
            $newLines += "${indent}await emitEvent(tx, {"
            $newLines += "${indent}  aggregateType: AggregateType.SYSTEM,"
            $newLines += "${indent}  aggregateId: entry.journalEntryId,"
            $newLines += "${indent}  eventType: 'gl_posted',"
            $newLines += "${indent}  payload: $($fields['payload']),"
            $newLines += "${indent}  actor: meta.actor,"
            $newLines += "${indent}});"
            $i = $j
            continue
        }
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] GL service migration complete"


# ── inventory.service.ts ────────────────────────────────────────────────────────────────
$f = "$api\inventory\inventory.service.ts"
Write-Host "`n=== inventory.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  outbox,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -match '// 4\. Emit Outbox Event' -or $lines[$i].Trim() -match '// Emit Outbox Event') {
        $newLines += $lines[$i]
        $i++
        if ($lines[$i].Trim() -eq 'await tx.insert(outbox).values({') {
            $j = $i + 1
            $fields = @{}
            while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
                $line = $lines[$j].Trim().TrimEnd(',')
                if ($line -match '^(\w+):\s*(.+)$') {
                    $fields[$matches[1]] = $matches[2]
                }
                $j++
            }
            $indent = $lines[$i] -replace '\S.*', ''
            $newLines += "${indent}await emitEvent(tx, {"
            $newLines += "${indent}  aggregateType: AggregateType.SYSTEM,"
            $newLines += "${indent}  aggregateId: entry.entryId,"
            $newLines += "${indent}  eventType: 'INVENTORY_ENTRY_CREATED',"
            $newLines += "${indent}  payload: { header: params, lines: ledgerPayload },"
            $newLines += "${indent}  actor: params.userId,"
            $newLines += "${indent}});"
            $i = $j
            continue
        }
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Inventory service migration complete"


# ── products-write.service.ts ───────────────────────────────────────────────────────────
$f = "$api\products\products-write.service.ts"
Write-Host "`n=== products-write.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  productEvents,`r`n", "")
$content = $content.Replace("  productSupplierEvents,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Replace productEvents inserts
$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(productEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.PRODUCT,"
        $newLines += "${indent}  aggregateId: $($fields['productId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    if ($lines[$i].Trim() -eq 'await tx.insert(productSupplierEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.PRODUCT_SUPPLIER,"
        $newLines += "${indent}  aggregateId: $($fields['productSupplierId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Products write service migration complete"


# ── accounts-write.service.ts ───────────────────────────────────────────────────────────
$f = "$api\accounts\accounts-write.service.ts"
Write-Host "`n=== accounts-write.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  accountEvents,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(accountEvents).values({') {
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent(tx, {"
        $newLines += "${indent}  aggregateType: AggregateType.ACCOUNT,"
        $newLines += "${indent}  aggregateId: $($fields['accountId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Accounts write service migration complete"


# ── suppliers-write.service.ts ──────────────────────────────────────────────────────────
$f = "$api\suppliers\suppliers-write.service.ts"
Write-Host "`n=== suppliers-write.service.ts ==="

$content = [System.IO.File]::ReadAllText($f)

$content = $content.Replace("  supplierEvents,`r`n", "")
$content = $content.Replace(
    "} from '../drizzle/modbm-core-schema';",
    "} from '../drizzle/modbm-core-schema';`r`nimport { emitEvent } from '../common/emit-event';`r`nimport { AggregateType } from '../common/event-types';")

# Replace both tx.insert and this.db.insert patterns for supplierEvents
$lines = $content -split "`r`n"
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'await tx.insert(supplierEvents).values({' -or $lines[$i].Trim() -eq 'await this.db.insert(supplierEvents).values({') {
        $dbRef = if ($lines[$i].Trim().StartsWith('await this.db')) { 'this.db' } else { 'tx' }
        $j = $i + 1
        $fields = @{}
        while ($j -lt $lines.Count -and $lines[$j].Trim() -ne '});') {
            $line = $lines[$j].Trim().TrimEnd(',')
            if ($line -match '^(\w+):\s*(.+)$') {
                $fields[$matches[1]] = $matches[2]
            }
            $j++
        }
        $indent = $lines[$i] -replace '\S.*', ''
        $newLines += "${indent}await emitEvent($dbRef, {"
        $newLines += "${indent}  aggregateType: AggregateType.SUPPLIER,"
        $newLines += "${indent}  aggregateId: $($fields['vendorId']),"
        $newLines += "${indent}  eventType: $($fields['eventType']),"
        $newLines += "${indent}  payload: $($fields['payload']),"
        if ($fields['actor']) { $newLines += "${indent}  actor: $($fields['actor'])," }
        $newLines += "${indent}});"
        $i = $j
        continue
    }
    $newLines += $lines[$i]
}
$content = $newLines -join "`r`n"
[System.IO.File]::WriteAllText($f, $content)
Write-Host "  [DONE] Suppliers write service migration complete"


Write-Host "`n=== ALL MIGRATIONS COMPLETE ==="
