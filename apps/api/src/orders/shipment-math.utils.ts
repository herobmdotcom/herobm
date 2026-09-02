import { BadRequestException } from '@nestjs/common';

/**
 * Pure business logic calculation to validate if a shipment quantity is permissible.
 * Prevents shipping stock that hasn't been picked or is already committed to other shipments.
 */
export function validateShipmentQuantity(
  requestedQty: number | string,
  pickedQty: number | string,
  alreadyCommittedQty: number | string,
  lineNumber: number | string,
): void {
  const reqQty =
    typeof requestedQty === 'string' ? parseFloat(requestedQty) : requestedQty;
  const picked =
    typeof pickedQty === 'string' ? parseFloat(pickedQty) : pickedQty;
  const committed =
    typeof alreadyCommittedQty === 'string'
      ? parseFloat(alreadyCommittedQty)
      : alreadyCommittedQty;

  if (isNaN(reqQty) || reqQty <= 0) {
    throw new BadRequestException('Shipped quantity must be greater than 0');
  }

  const available = picked - committed;

  if (reqQty > available) {
    throw new BadRequestException(
      `Cannot ship ${reqQty} of line ${lineNumber} — only ${available} available (${picked} picked, ${committed} already committed).`,
    );
  }
}
