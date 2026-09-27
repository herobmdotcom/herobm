import Decimal from 'decimal.js';

export interface ProductCostData {
  productId: string;
  standardCost: string;
  weightedAverageCost: string;
}

export interface GoodsReceiptValuation {
  /** The new calculated WAC to save to the product. For Standard Costing, this is unchanged from previous WAC (0). */
  newWeightedAverageCost: string;

  /**
   * The value to debit to the Inventory GL customer.
   * WAC: Qty * Actual Unit Cost
   * Standard: Qty * Standard Cost
   */
  inventoryValueAdded: string;

  /**
   * The variance to post to the Purchase Price Variance GL customer.
   * WAC: 0
   * Standard: (Actual Unit Cost - Standard Cost) * Qty
   * Positive variance = Actual Cost > Standard Cost (Debit variance expense)
   */
  purchasePriceVariance: string;
}

export interface ValuationStrategy {
  getCogs(
    product: ProductCostData,
    qtyShipped: number | string | Decimal,
    currentQuantityOnHand?: number | string | Decimal,
    totalInventoryValue?: number | string | Decimal,
  ): string;
  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation;
  onGoodsReceiptReversal(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyCancelled: number,
    unitCost: string,
  ): { newWeightedAverageCost: string };
}

export class WeightedAverageStrategy implements ValuationStrategy {
  getCogs(
    product: ProductCostData,
    qtyShipped: number | string | Decimal,
    currentQuantityOnHand?: number | string | Decimal,
    totalInventoryValue?: number | string | Decimal,
  ): string {
    const qty = new Decimal(qtyShipped || '0');
    const wac = new Decimal(product.weightedAverageCost || '0');
    if (qty.isZero()) return '0.00';

    if (currentQuantityOnHand != null && totalInventoryValue != null) {
      const qoh = new Decimal(currentQuantityOnHand);
      const totalVal = new Decimal(totalInventoryValue);
      // When depleting the entirety of remaining inventory, absorb full residual valuation
      if (qoh.gt(0) && qty.gte(qoh)) {
        return totalVal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
      }
    }

    return wac.mul(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  }

  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation {
    const currentWac = new Decimal(product.weightedAverageCost || '0');
    const receivedCost = new Decimal(actualUnitCost || '0');
    const qoh = new Decimal(currentQuantityOnHand);
    const qtyRec = new Decimal(qtyReceived);

    const totalExistingValue = qoh.mul(currentWac);
    const totalReceivedValue = qtyRec.mul(receivedCost);

    const newQuantityOnHand = qoh.plus(qtyRec);

    // Protect against division by zero (e.g. if new QOH is exactly 0 due to negative receipts, edge case)
    const newWeightedAverageCost = newQuantityOnHand.gt(0)
      ? totalExistingValue.plus(totalReceivedValue).div(newQuantityOnHand)
      : currentWac;

    return {
      newWeightedAverageCost: newWeightedAverageCost.toFixed(4),
      inventoryValueAdded: totalReceivedValue.toFixed(2),
      purchasePriceVariance: '0.00', // WAC never records variance at receipt
    };
  }

  onGoodsReceiptReversal(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyCancelled: number,
    unitCost: string,
  ): { newWeightedAverageCost: string } {
    const currentWac = new Decimal(product.weightedAverageCost || '0');
    const costOfCancelled = new Decimal(unitCost || '0');
    const qoh = new Decimal(currentQuantityOnHand);
    const qtyCanc = new Decimal(qtyCancelled);

    const totalExistingValue = qoh.mul(currentWac);
    const totalCancelledValue = qtyCanc.mul(costOfCancelled);

    const remainingQuantity = qoh.minus(qtyCanc);

    let newWeightedAverageCost = currentWac;
    if (remainingQuantity.gt(0.0001)) {
      const remainingValue = totalExistingValue.minus(totalCancelledValue);
      const calculated = remainingValue.div(remainingQuantity);
      newWeightedAverageCost = calculated.gt(0) ? calculated : new Decimal(0);
    } else {
      const stdCost = new Decimal(product.standardCost || '0');
      newWeightedAverageCost = stdCost.gt(0) ? stdCost : currentWac;
    }

    return {
      newWeightedAverageCost: newWeightedAverageCost.toFixed(4),
    };
  }
}

export class StandardCostStrategy implements ValuationStrategy {
  getCogs(
    product: ProductCostData,
    qtyShipped: number | string | Decimal,
  ): string {
    const stdCost = new Decimal(product.standardCost || '0');
    const qty = new Decimal(qtyShipped || '0');
    return stdCost
      .mul(qty)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);
  }

  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation {
    const stdCost = new Decimal(product.standardCost || '0');
    const receivedCost = new Decimal(actualUnitCost || '0');
    const qtyRec = new Decimal(qtyReceived);

    const inventoryValueAdded = qtyRec.mul(stdCost);
    const variancePerUnit = receivedCost.minus(stdCost);
    const totalVariance = variancePerUnit.mul(qtyRec);

    return {
      newWeightedAverageCost: product.weightedAverageCost, // Unchanged
      inventoryValueAdded: inventoryValueAdded.toFixed(2),
      purchasePriceVariance: totalVariance.toFixed(2),
    };
  }

  onGoodsReceiptReversal(
    product: ProductCostData,
    _currentQuantityOnHand: number,
    _qtyCancelled: number,
    _unitCost: string,
  ): { newWeightedAverageCost: string } {
    return {
      newWeightedAverageCost: product.weightedAverageCost, // Unchanged
    };
  }
}

export function getValuationStrategy(
  method: string | undefined,
): ValuationStrategy {
  const methodCode = (method || 'weighted_average').toLowerCase();
  if (methodCode === 'standard') {
    return new StandardCostStrategy();
  }
  return new WeightedAverageStrategy();
}
