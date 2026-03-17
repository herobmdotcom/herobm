'use client';

import { Sidebar as SharedSidebar } from '@modbm/portal-ui';
import type { NavItem } from '@modbm/portal-ui';

const navItems: NavItem[] = [
  { href: '/', label: 'Orders', icon: '📋' },
  { href: '/purchase-orders/new', label: 'New Order', icon: '➕' },
];

export default function Sidebar() {
  return (
    <SharedSidebar
      title="Supplier Portal"
      subtitle="Purchase Orders"
      navItems={navItems}
    />
  );
}
