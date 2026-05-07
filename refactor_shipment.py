import re

with open('apps/api/src/orders/shipment.service.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update changeShipmentState
state_change_start = content.find('async changeShipmentState(')
if state_change_start == -1:
    print("Could not find changeShipmentState")
    exit(1)

allowed_check = """        if (!allowed || !allowed.includes(newState)) {
          throw new BadRequestException(
            `Cannot transition shipment from '${shipment.stateCode}' to '${newState}'. ` +
              `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
          );
        }"""

new_allowed_check = allowed_check + """

        if (newState === 'cancelled') {
          throw new BadRequestException('Please use the dedicated POST /cancel endpoint to cancel a shipment.');
        }"""

content = content.replace(allowed_check, new_allowed_check)

# 2. Extract the physicalStockLines logic from changeShipmentState
inventory_hooks_start = content.find('        // ── Inventory hooks ──')
inventory_hooks_end = content.find('        const eventType =', inventory_hooks_start)

extracted_block = content[inventory_hooks_start:inventory_hooks_end]

# Remove the block from changeShipmentState
content = content[:inventory_hooks_start] + content[inventory_hooks_end:]

# 3. Create the new cancelShipment method
cancel_method = f"""  /**
   * Cancel a shipment.
   * Reverses inventory, picks, and financial entries if the shipment was dispatched.
   */
  async cancelShipment(shipmentId: string, actor: string, tx?: DrizzleDB) {{
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {{
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode === 'cancelled') {{
          throw new BadRequestException('Shipment is already cancelled.');
        }}

        const allowed = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode];
        if (!allowed || !allowed.includes('cancelled')) {{
          throw new BadRequestException(
            `Cannot transition shipment from '${{shipment.stateCode}}' to 'cancelled'. Allowed transitions: ${{allowed?.join(', ') || 'none'}}`,
          );
        }}

{extracted_block}
        const [updated] = await innerTx
          .update(salesOrderShipments)
          .set({{ stateCode: 'cancelled', modifiedOn: new Date() }})
          .where(eq(salesOrderShipments.shipmentId, shipmentId))
          .returning();

        await emitEvent(innerTx, {{
          aggregateType: AggregateType.SHIPMENT,
          aggregateId: shipmentId,
          eventType: 'shipment_status_changed',
          payload: {{
            shipmentId,
            shipmentNumber: shipment.shipmentNumber,
            from: shipment.stateCode,
            to: 'cancelled',
          }},
          actor,
        }});

        const autoTransitions = await evaluateLifecycleRules(
          innerTx,
          shipment.salesOrderId,
          {{ entity: 'shipment', id: shipmentId, action: 'cancelled' }},
          actor,
        );

        this.logger.log(
          `Shipment ${{shipment.shipmentNumber}} state: ${{shipment.stateCode}} → cancelled by ${{actor}}`,
        );

        return {{ ...updated, _autoTransitions: autoTransitions }};
      }},
    );

    return result;
  }}
"""

change_end_idx = content.find('    return result;\n  }', state_change_start)
change_end_idx = content.find('}', change_end_idx) + 1

content = content[:change_end_idx] + "\n\n" + cancel_method + content[change_end_idx:]

with open('apps/api/src/orders/shipment.service.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
