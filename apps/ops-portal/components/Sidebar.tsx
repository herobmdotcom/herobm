'use client';

import { Sidebar as SharedSidebar } from '@modbm/portal-ui';
import type { NavSection } from '@modbm/portal-ui';

const sections: NavSection[] = [
  {
    items: [
      { href: '/', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/products', label: 'Products', icon: '🏷️' },
      { href: '/inventory', label: 'Inventory', icon: '📦' },
      { href: '/bins', label: 'Bin Contents', icon: '🗄️' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/accounts', label: 'Accounts', icon: '🏢' },
      { href: '/sales-orders', label: 'Sales Orders', icon: '📋' },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { href: '/suppliers', label: 'Suppliers', icon: '🏭' },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: '📦' },
    ],
  },
];

export default function Sidebar() {
  return (
    <SharedSidebar
      title="modbm"
      subtitle="Business Management"
      sections={sections}
    />
  );
}
