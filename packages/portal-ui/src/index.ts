// Components
export { default as DataGrid } from './components/DataGrid';
export type { DataGridProps } from './components/DataGrid';
export { default as OrderDetailReadView } from './components/OrderDetailReadView';
export { EventIcon, StateBadge } from './components/OrderDetailReadView';
export type { OrderDetailReadViewProps, OrderDetailData, OrderLine, OrderEvent } from './components/OrderDetailReadView';
export { default as AuthGate, useAuth } from './components/AuthGate';
export type { AuthGateProps } from './components/AuthGate';
export { default as Sidebar } from './components/Sidebar';
export type { SidebarProps, NavItem } from './components/Sidebar';
export { default as Shell } from './components/Shell';
export { default as OrderTotalsCard } from './components/OrderTotalsCard';
export { default as ProductSearchInput } from './components/ProductSearchInput';
export type { Product } from './components/ProductSearchInput';
export { default as PickingSection } from './components/PickingSection';

// Lib
export { login, getToken, setToken, apiFetch, apiMutate, reportError } from './lib/api';
export {
  CURRENCY_DISPLAY,
  CURRENCIES,
  HOME_CURRENCY,
  getCurrency,
  getCurrencyByAbmCode,
  formatAmount,
} from './lib/currency';
export type { CurrencyDef } from './lib/currency';

// Theme
export { theme } from './theme';
export type { Theme } from './theme';
