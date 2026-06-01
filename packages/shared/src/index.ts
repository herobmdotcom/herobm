
export {
  // Transition maps
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
  PURCHASE_INVOICE_TRANSITIONS,
  SALES_INVOICE_TRANSITIONS,
  RECONCILIATION_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  GOODS_RECEIVED_TRANSITIONS,
  PURCHASE_RETURN_TRANSITIONS,
  PURCHASE_RETURN_SHIPMENT_TRANSITIONS,
  PURCHASE_DEBIT_NOTE_TRANSITIONS,
  RETURN_TRANSITIONS,
  SALES_CREDIT_NOTE_TRANSITIONS,
  SALES_ORDER_PICK_TRANSITIONS,
  BACKORDER_TRANSITIONS,
  TRANSFER_ORDER_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  TRANSFER_ORDER_PICK_TRANSITIONS,
  CUSTOMER_TRANSITIONS,
  SUPPLIER_TRANSITIONS,
  PRODUCT_TRANSITIONS,
  RECEIPT_TRANSITIONS,
  PUTAWAY_STATUS,
  MATCH_STATUS,
  
  // State constants
  SALES_ORDER_STATE,
  PURCHASE_ORDER_STATE,
  PURCHASE_INVOICE_STATE,
  SALES_INVOICE_STATE,
  SHIPMENT_STATE,
  GOODS_RECEIVED_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  RETURN_STATE,
  SALES_CREDIT_NOTE_STATE,
  SALES_ORDER_PICK_STATE,
  BACKORDER_STATE,
  TRANSFER_ORDER_STATE,
  RECONCILIATION_STATE,
  PAYMENT_STATE,
  CUSTOMER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  SUPPLIER_STATE,
  PRODUCT_STATE,
  RECEIPT_STATE,
  // Lifecycle ordinals (for UI forward/backward styling)
  SALES_ORDER_LIFECYCLE,
  PURCHASE_ORDER_LIFECYCLE,
  OPEN_PURCHASE_ORDER_STATES,
  PURCHASE_INVOICE_LIFECYCLE,
  SALES_INVOICE_LIFECYCLE,
  RECONCILIATION_LIFECYCLE,
  SHIPMENT_LIFECYCLE,
  PURCHASE_RETURN_LIFECYCLE,
  PURCHASE_RETURN_SHIPMENT_LIFECYCLE,
  PURCHASE_DEBIT_NOTE_LIFECYCLE,
  RETURN_LIFECYCLE,
  SALES_CREDIT_NOTE_LIFECYCLE,
  SALES_ORDER_PICK_LIFECYCLE,
  BACKORDER_LIFECYCLE,
  RECEIPT_LIFECYCLE,

  // Helpers
  getAllowedTransitions,
  getValidStates,
  isBackTransition,
  cap,
} from './state-machines';

export type {
  // Union types
  SalesOrderState,
  PurchaseOrderState,
  PurchaseInvoiceState,
  SalesInvoiceState,
  ShipmentState,
  GoodsReceivedState,
  PurchaseReturnState,
  PurchaseReturnShipmentState,
  PurchaseDebitNoteState,
  ReturnState,
  SalesCreditNoteState,
  SalesOrderPickState,
  BackorderState,
  TransferOrderState,
  PaymentState,
  TransferOrderPickState,
  CustomerState,
  SupplierState,
  ProductState,
  ReconciliationState,
} from './state-machines';

export {
  computeLinePrice,
  computeLinePriceForStorage,
  computeOrderTotals,
  computeReturnCreditSummary,
  resolveEffectiveDiscount,
} from './pricing';



export {
  formatCompositeQuantity,
  calculateUomPriceAdjustment,
} from './uom';

export {
  CURRENCIES,
  CURRENCY_DISPLAY,
  getCurrency,
  getCurrencyByAbmCode,
  formatAmount,
  REVENUE_ROUTING_PRECEDENCE,
  EXPENSE_ROUTING_PRECEDENCE,
} from './currency';

export {
  SYSTEM_REPORTS,
  PUBLIC_REPORT_HOOKS,
  getReportByHook,
  getReportBySlug,
} from './reports';

export {
  calculateInventoryGaps,
  calculateAvailableQuantity,
} from './inventory';
export type { InventoryLevelMinimal, OrderLineMinimal, InventoryGap, InventoryLevelData } from './inventory';

export type { ReportDefinition } from './reports';

export type { ProductUom } from './uom';
export type { LinePricingInput, LinePricingResult, OrderTotalsResult, DiscountRule } from './pricing';
export type { CurrencyDef, RevenueRoutingStrategy, ExpenseRoutingStrategy } from './currency';

export type ProductType = 'inventory' | 'non-stock' | 'service';

export {
  GL_ACCOUNT_TYPE,
} from './accounting';
export type { GLAccountType } from './accounting';

export {
  getErrorMessage,
} from './errors';
