import { BadRequestException } from '@nestjs/common';

/**
 * Pure business logic calculation to validate if a return quantity is permissible.
 * Prevents customers from returning stock they never purchased or have already returned.
 */
export function validateReturnQuantity(
  requestedQuantity: number | string,
  originalShipped: number | string,
  alreadyReturned: number | string,
  lineNumber: number | string,
): void {
  const reqQty = typeof requestedQuantity === 'string' ? parseFloat(requestedQuantity) : requestedQuantity;
  const origQty = typeof originalShipped === 'string' ? parseFloat(originalShipped) : originalShipped;
  const returnedQty = typeof alreadyReturned === 'string' ? parseFloat(alreadyReturned) : alreadyReturned;

  if (isNaN(reqQty) || reqQty <= 0) {
    throw new BadRequestException('Return quantity must be greater than 0');
  }

  if (reqQty > origQty - returnedQty) {
    throw new BadRequestException(
      `Cannot return ${reqQty} of line ${lineNumber}. ` +
      `Original qty: ${origQty}, already returned: ${returnedQty}, ` +
      `remaining returnable: ${origQty - returnedQty}`
    );
  }
}
