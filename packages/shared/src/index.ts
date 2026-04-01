export {
  // Transition maps
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  RETURN_TRANSITIONS,

  // Lifecycle ordinals (for UI forward/backward styling)
  SALES_ORDER_LIFECYCLE,
  PURCHASE_ORDER_LIFECYCLE,
  SHIPMENT_LIFECYCLE,
  RETURN_LIFECYCLE,

  // Helpers
  getAllowedTransitions,
  getValidStates,
  isBackTransition,
  cap,
} from './state-machines';

export {
  computeLinePrice,
  computeLinePriceForStorage,
  computeOrderTotals,
  resolveEffectiveDiscount,
} from './pricing';

export {
  formatCompositeQuantity,
  calculateUomPriceAdjustment,
} from './uom';

export {
  CURRENCIES,
  CURRENCY_DISPLAY,
  HOME_CURRENCY,
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

export type { ReportDefinition } from './reports';

export type { ProductUom } from './uom';
export type { LinePricingInput, LinePricingResult, OrderTotalsResult } from './pricing';
export type { CurrencyDef, RevenueRoutingStrategy, ExpenseRoutingStrategy } from './currency';

export type ProductType = 'inventory' | 'non-stock' | 'service';
