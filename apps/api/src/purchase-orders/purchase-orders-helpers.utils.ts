import Decimal from 'decimal.js';
import {
  computeLinePriceForStorage,
  normalizeUomCode,
  LineType,
  PURCHASE_ORDER_STATE,
  type PurchaseOrderState,
} from '@herobm/shared';

export function resolveSupplierLinePricingAndMoq(
  lineDto: {
    quantity?: string | number;
    pricePerUnit?: string | number;
    discountPercentage?: string | number;
  },
  supplierInfo?: {
    costPrice?: string | null;
    minPurchaseQty?: string | null;
    discountPercent?: string | null;
  } | null,
): { qty: number; price: number; disc: number } {
  const supplierMoq = supplierInfo?.minPurchaseQty
    ? new Decimal(supplierInfo.minPurchaseQty).toNumber()
    : null;
  const supplierCost = supplierInfo?.costPrice
    ? new Decimal(supplierInfo.costPrice).toNumber()
    : null;
  const supplierDisc = supplierInfo?.discountPercent
    ? new Decimal(supplierInfo.discountPercent).toNumber()
    : null;

  let qty: number;
  if (
    (lineDto.quantity === undefined ||
      lineDto.quantity === null ||
      lineDto.quantity === '1' ||
      lineDto.quantity === 1) &&
    supplierMoq &&
    supplierMoq > 1
  ) {
    qty = supplierMoq;
  } else {
    qty = new Decimal(lineDto.quantity ?? '1').toNumber();
  }

  let price: number;
  if (
    (!lineDto.pricePerUnit ||
      lineDto.pricePerUnit === '0' ||
      lineDto.pricePerUnit === '0.00' ||
      lineDto.pricePerUnit === 0) &&
    supplierCost !== null &&
    supplierCost !== undefined
  ) {
    price = supplierCost;
  } else {
    price = new Decimal(lineDto.pricePerUnit || '0').toNumber();
  }

  let disc: number;
  if (
    (!lineDto.discountPercentage ||
      lineDto.discountPercentage === '0' ||
      lineDto.discountPercentage === 0) &&
    supplierDisc !== null &&
    supplierDisc !== undefined
  ) {
    disc = supplierDisc;
  } else {
    disc = new Decimal(lineDto.discountPercentage || '0').toNumber();
  }

  return { qty, price, disc };
}

export function calculateUpdatedLinePricing(
  lineDto: {
    lineType?: string;
    quantity?: string | number;
    pricePerUnit?: string | number;
    discountPercentage?: string | number;
  },
  existingLine:
    | {
        lineType?: string | null;
        quantity?: string | null;
        pricePerUnit?: string | null;
        discountPercentage?: string | null;
      }
    | undefined,
  rate: number,
): {
  amount: string;
  tax: string;
  totalAmount: string;
} {
  const isComment =
    (lineDto.lineType ?? existingLine?.lineType) ===
    (LineType.COMMENT as string);
  if (isComment) {
    return { amount: '0', tax: '0', totalAmount: '0' };
  }
  const qty = new Decimal(
    lineDto.quantity?.toString() || existingLine?.quantity || '0',
  ).toNumber();
  const price = new Decimal(
    lineDto.pricePerUnit?.toString() || existingLine?.pricePerUnit || '0',
  ).toNumber();
  const disc = new Decimal(
    lineDto.discountPercentage?.toString() ||
      existingLine?.discountPercentage ||
      '0',
  ).toNumber();

  return computeLinePriceForStorage({
    quantity: qty,
    pricePerUnit: price,
    discountPercentage: disc,
    taxRate: rate,
  });
}

export function calculateNextPoReceiptState(
  allLines: { quantity: string; quantityReceived?: string | null }[],
  currentState: PurchaseOrderState,
  fallbackToOrdered = false,
): PurchaseOrderState {
  const isFullyReceived =
    allLines.length > 0 &&
    allLines.every((l) =>
      new Decimal(l.quantityReceived || '0').greaterThanOrEqualTo(
        new Decimal(l.quantity || '0'),
      ),
    );

  const hasPartialReceipt = allLines.some((l) =>
    new Decimal(l.quantityReceived || '0').greaterThan(0),
  );

  return isFullyReceived
    ? PURCHASE_ORDER_STATE.RECEIVED
    : hasPartialReceipt
      ? PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED
      : fallbackToOrdered
        ? PURCHASE_ORDER_STATE.ORDERED
        : currentState;
}

export function buildRequisitionLineRecords(
  poId: string,
  lines: {
    productId: string;
    productDescription?: string;
    quantity: string;
    pricePerUnit: string;
    taxCategoryId: string;
  }[],
) {
  return lines.map((line, idx) => ({
    purchaseOrderId: poId,
    lineNumber: idx + 1,
    productId: line.productId,
    productDescription: line.productDescription,
    quantity: line.quantity,
    pricePerUnit: line.pricePerUnit,
    taxCategoryId: line.taxCategoryId,
    discountPercentage: '0',
    amount: '0',
    tax: '0',
    quantityReceived: '0',
  }));
}

export function buildCreatePoLineRecord(
  orderId: string,
  index: number,
  line: {
    lineType?: string;
    productId?: string | null;
    productDescription?: string;
    quantity?: string | number;
    pricePerUnit?: string | number;
    discountPercentage?: string | number;
    unitOfMeasure?: string;
    taxCategoryId?: string | null;
  },
  rate: number,
  taxCategoryId: string | null,
) {
  const isComment = line.lineType === LineType.COMMENT;
  if (isComment) {
    return {
      purchaseOrderId: orderId,
      lineNumber: index + 1,
      lineType: LineType.COMMENT,
      productId: null,
      productDescription: line.productDescription,
      quantity: '0',
      pricePerUnit: '0',
      discountPercentage: '0',
      unitOfMeasure: null,
      amount: '0',
      tax: '0',
      totalAmount: '0',
      taxCategoryId: null,
    };
  }

  const disc = new Decimal(line.discountPercentage || '0').toNumber();
  const pricing = computeLinePriceForStorage({
    quantity: new Decimal(line.quantity || '0').toNumber(),
    pricePerUnit: new Decimal(line.pricePerUnit || '0').toNumber(),
    discountPercentage: disc,
    taxRate: rate,
  });

  return {
    purchaseOrderId: orderId,
    lineNumber: index + 1,
    lineType: LineType.PRODUCT,
    productId: line.productId,
    productDescription: line.productDescription,
    quantity: String(line.quantity ?? '1'),
    pricePerUnit: String(line.pricePerUnit ?? '0'),
    discountPercentage: line.discountPercentage?.toString() || '0',
    unitOfMeasure: normalizeUomCode(line.unitOfMeasure),
    amount: pricing.amount,
    tax: pricing.tax,
    totalAmount: pricing.totalAmount,
    taxCategoryId,
  };
}
