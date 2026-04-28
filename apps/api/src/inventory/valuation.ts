export interface ProductCostData {
  productId: string;
  standardCost: string;
  weightedAverageCost: string;
}

export interface GoodsReceiptValuation {
  /** The new calculated WAC to save to the product. For Standard Costing, this is unchanged from previous WAC (0). */
  newWeightedAverageCost: string;

  /**
   * The value to debit to the Inventory GL account.
   * WAC: Qty * Actual Unit Cost
   * Standard: Qty * Standard Cost
   */
  inventoryValueAdded: string;

  /**
   * The variance to post to the Purchase Price Variance GL account.
   * WAC: 0
   * Standard: (Actual Unit Cost - Standard Cost) * Qty
   * Positive variance = Actual Cost > Standard Cost (Debit variance expense)
   */
  purchasePriceVariance: string;
}

export interface ValuationStrategy {
  getCogs(product: ProductCostData, qtyShipped: number): string;
  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation;
}

export class WeightedAverageStrategy implements ValuationStrategy {
  getCogs(product: ProductCostData, qtyShipped: number): string {
    const wac = parseFloat(product.weightedAverageCost || '0');
    return (wac * qtyShipped).toFixed(2);
  }

  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation {
    const currentWac = parseFloat(product.weightedAverageCost || '0');
    const receivedCost = parseFloat(actualUnitCost || '0');

    const totalExistingValue = currentQuantityOnHand * currentWac;
    const totalReceivedValue = qtyReceived * receivedCost;

    const newQuantityOnHand = currentQuantityOnHand + qtyReceived;

    // Protect against division by zero (e.g. if new QOH is exactly 0 due to negative receipts, edge case)
    const newWeightedAverageCost =
      newQuantityOnHand > 0
        ? (totalExistingValue + totalReceivedValue) / newQuantityOnHand
        : 0;

    return {
      newWeightedAverageCost: newWeightedAverageCost.toFixed(4),
      inventoryValueAdded: totalReceivedValue.toFixed(2),
      purchasePriceVariance: '0.00', // WAC never records variance at receipt
    };
  }
}

export class StandardCostStrategy implements ValuationStrategy {
  getCogs(product: ProductCostData, qtyShipped: number): string {
    const stdCost = parseFloat(product.standardCost || '0');
    return (stdCost * qtyShipped).toFixed(2);
  }

  onGoodsReceipt(
    product: ProductCostData,
    currentQuantityOnHand: number,
    qtyReceived: number,
    actualUnitCost: string,
  ): GoodsReceiptValuation {
    const stdCost = parseFloat(product.standardCost || '0');
    const receivedCost = parseFloat(actualUnitCost || '0');

    const inventoryValueAdded = qtyReceived * stdCost;
    const variancePerUnit = receivedCost - stdCost;
    const totalVariance = variancePerUnit * qtyReceived;

    return {
      newWeightedAverageCost: product.weightedAverageCost, // Unchanged
      inventoryValueAdded: inventoryValueAdded.toFixed(2),
      purchasePriceVariance: totalVariance.toFixed(2),
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
