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
  WORK_ORDER_TRANSITIONS,
  WORK_ORDER_PICK_TRANSITIONS,

  PUTAWAY_STATUS,
  type PutawayStatus,
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
  RETURN_RESOLUTION,
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
  PROJECT_STATE,
  ACTOR_STATE,
  CONTACT_STATE,
  WORK_ORDER_STATE,
  WORK_ORDER_PICK_STATE,

  PAYMENT_TYPE,
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
  ReturnResolution,
  SalesCreditNoteState,
  SalesOrderPickState,
  BackorderState,
  TransferOrderState,
  PaymentState,
  PaymentType,
  TransferOrderPickState,
  CustomerState,
  SupplierState,
  ProductState,
  ActorState,
  ContactState,
  ProjectState,
  ReconciliationState,
  WorkOrderState,
  WorkOrderPickState,
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
  COUNTRIES,
  getCountryCode,
} from './countries';
export type { CountryDef } from './countries';

export {
  CURRENCIES,
  CURRENCY_DISPLAY,
  getCurrency,
  getCurrencyByAbmCode,
  formatAmount,
  REVENUE_ROUTING_PRECEDENCE,
  EXPENSE_ROUTING_PRECEDENCE,
  getCurrencyForCountry,
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
  compareBinNumbers,
  BIN_TYPE,
  isPhysicalProductLine,
} from './inventory';
export type { InventoryLevelMinimal, OrderLineMinimal, InventoryGap, InventoryLevelData, ProductType } from './inventory';

export type { ReportDefinition } from './reports';

export type { ProductUom } from './uom';
export type { LinePricingInput, LinePricingResult, OrderTotalsResult, DiscountRule } from './pricing';
export type { CurrencyDef, RevenueRoutingStrategy, ExpenseRoutingStrategy } from './currency';


export {
  GL_ACCOUNT_TYPE,
  calculateAgedTotals,
} from './accounting';
export type { GLAccountType, AgedBalanceRow, AgedTotals } from './accounting';

export * from './errors';
export * from './invoice-discounts';

export { SystemResource, hasPermission, hasAnyPermission } from './permissions';
export type { Permission } from './permissions';
export * from './data-sources';
