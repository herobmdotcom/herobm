import { TRANSFER_ORDER_STATE } from './state-machines';

export const DEFAULT_PROJECT_STAGES: Array<{
  value: string;
  order: number;
}> = [
  { value: 'Planning', order: 1 },
  { value: 'In Progress', order: 2 },
  { value: 'On Hold', order: 3 },
  { value: 'QA & Review', order: 4 },
  { value: 'Completed', order: 5 },
  { value: 'Cancelled', order: 6 },
];

export interface ProjectMaterialSummary {
  productId: string;
  productNumber: string;
  productDescription: string;
  stagedQty: number;
  arrivingQty: number;
  returningQty: number;
  consumedQty: number;
  returnedQty: number;
  availableQty: number;
  totalCost: number;
  transferredQty?: number;
}

export interface ProjectStagingInventoryInput {
  productId?: string | null;
  productNumber?: string | null;
  productName?: string | null;
  actualQuantity?: string | number | null;
  baseUom?: string | null;
}

export interface ProjectTransferLineInput {
  productId?: string | null;
  productNumber?: string | null;
  productDescription?: string | null;
  quantity?: string | number | null;
  quantityShipped?: string | number | null;
  quantityReceived?: string | number | null;
  quantityPutaway?: string | number | null;
}

export interface ProjectTransferOrderInput {
  transferOrderId?: string;
  orderNumber?: string;
  stateCode?: string | null;
  isProjectReturn?: boolean | null;
  lines?: ProjectTransferLineInput[] | null;
}

export interface ProjectLedgerEntryInput {
  entryType?: string | null;
  lineType?: string | null;
  sourceType?: string | null;
  productId?: string | null;
  description?: string | null;
  quantity?: string | number | null;
  totalCostBase?: string | number | null;
}

/**
 * Pure calculation of available project staging stock.
 * Formula: Math.max(0, stagedQty - returningQty)
 * Stock in the staging bin that has not been marked/committed for return.
 */
export function calculateProjectStagingAvailableQuantity(
  stagedQty: number,
  returningQty: number,
): number {
  const staged = Number(stagedQty) || 0;
  const returning = Number(returningQty) || 0;
  return Math.max(0, staged - returning);
}

/**
 * Aggregates staging bin inventory (physical on-hand), inbound transfer orders (arriving),
 * open return transfer orders (returning), and project subledger usage/credit entries
 * into a unified materials summary with real-time available staging balances.
 */
export function calculateProjectMaterialsSummary(
  stagedStock: ProjectStagingInventoryInput[] = [],
  transfers: ProjectTransferOrderInput[] = [],
  ledgerEntries: ProjectLedgerEntryInput[] = [],
): ProjectMaterialSummary[] {
  const map = new Map<string, ProjectMaterialSummary>();

  const getOrCreate = (
    key: string,
    prodId?: string | null,
    prodNumber?: string | null,
    prodDesc?: string | null,
  ): ProjectMaterialSummary => {
    let curr = map.get(key);
    if (!curr) {
      curr = {
        productId: prodId || '',
        productNumber: prodNumber || '—',
        productDescription: prodDesc || '—',
        stagedQty: 0,
        arrivingQty: 0,
        returningQty: 0,
        consumedQty: 0,
        returnedQty: 0,
        availableQty: 0,
        totalCost: 0,
      };
      map.set(key, curr);
    }
    if (prodId && !curr.productId) curr.productId = prodId;
    if (prodNumber && curr.productNumber === '—') curr.productNumber = prodNumber;
    if (prodDesc && curr.productDescription === '—') curr.productDescription = prodDesc;
    return curr;
  };

  // 1. Process Staged Inventory (Physical On-Hand in project staging bin)
  (stagedStock || []).forEach((stock) => {
    if (!stock) return;
    const prodKey = stock.productId || stock.productNumber || stock.productName || 'unknown';
    const curr = getOrCreate(prodKey, stock.productId, stock.productNumber, stock.productName);
    const q = Number(stock.actualQuantity || 0);
    curr.stagedQty += isNaN(q) ? 0 : q;
  });

  // 2. Process Transfer Orders (inbound arriving stock & open returning stock)
  (transfers || []).forEach((order) => {
    if (!order || order.stateCode === TRANSFER_ORDER_STATE.CANCELLED) return;
    const isReturn = Boolean(order.isProjectReturn);
    const orderLines = order.lines || [];

    if (isReturn) {
      // For return orders, only count open states where goods are still physically inside the staging bin
      // (CONFIRMED or PICKING). Once SHIPPED, stock has been deducted from bin_contents.
      const isOpenReturnInBin =
        order.stateCode === TRANSFER_ORDER_STATE.CONFIRMED ||
        order.stateCode === TRANSFER_ORDER_STATE.PICKING;

      if (!isOpenReturnInBin) return;

      orderLines.forEach((line) => {
        if (!line) return;
        const prodKey = line.productId || line.productNumber || line.productDescription || 'unknown';
        const curr = getOrCreate(prodKey, line.productId, line.productNumber, line.productDescription);
        const qtyReturning = Number(line.quantity || 0);
        curr.returningQty += isNaN(qtyReturning) ? 0 : qtyReturning;
      });
    } else {
      // Inbound transfer orders to project staging bin (Arriving stock)
      orderLines.forEach((line) => {
        if (!line) return;
        const prodKey = line.productId || line.productNumber || line.productDescription || 'unknown';
        const curr = getOrCreate(prodKey, line.productId, line.productNumber, line.productDescription);

        const totalQty = Number(line.quantity || 0);
        const putawayQty = Number(line.quantityPutaway || 0);

        // Arriving is whatever has not yet completed putaway into the staging bin
        let qtyArriving = 0;
        if (line.quantityPutaway != null) {
          qtyArriving = Math.max(0, totalQty - putawayQty);
        } else {
          // Fallback if putaway quantity is not explicitly tracked:
          // If RECEIVED without putaway tracking, assume completed; otherwise entire line is arriving
          if (order.stateCode !== TRANSFER_ORDER_STATE.RECEIVED) {
            qtyArriving = totalQty;
          }
        }

        curr.arrivingQty += isNaN(qtyArriving) ? 0 : qtyArriving;
      });
    }
  });

  // 3. Process Ledger entries (staging charges / task issues / return credits)
  (ledgerEntries || []).forEach((e) => {
    if (!e) return;
    if (
      (e.entryType === 'usage' &&
        (e.sourceType === 'inventory_issue' || e.lineType === 'item')) ||
      e.productId
    ) {
      const prodKey =
        e.productId || e.description || 'Material Issue';
      const curr = getOrCreate(
        prodKey,
        e.productId,
        undefined,
        e.description || 'Material Issue',
      );

      const q = Number(e.quantity || 0);
      const cost = Number(e.totalCostBase || 0);
      if (!isNaN(q)) {
        const desc = e.description || '';
        const isStagedEntry = desc.startsWith('Staged ') || desc.includes('Transfer Staging');
        const isReallocation = desc.startsWith('Reallocated from staging');
        const isReturnEntry = desc.startsWith('Returned ') || desc.includes('Return');

        if (q > 0) {
          if (!isStagedEntry && !isReallocation) {
            curr.consumedQty += q;
          }
        } else if (q < 0) {
          if (isReturnEntry) {
            curr.returnedQty += Math.abs(q);
          }
        }
      }
      if (!isNaN(cost)) {
        curr.totalCost += cost;
      }
    }
  });

  // 4. Compute available quantity
  return Array.from(map.values()).map((item) => ({
    ...item,
    transferredQty: item.stagedQty,
    availableQty: calculateProjectStagingAvailableQuantity(
      item.stagedQty,
      item.returningQty,
    ),
  }));
}
