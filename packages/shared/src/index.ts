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
