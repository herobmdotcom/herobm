'use client';

import { Sidebar as SharedSidebar } from '@modbm/portal-ui';
import type { NavItem } from '@modbm/portal-ui';

const navItems: NavItem[] = [
  { href: '/', label: 'Orders', icon: '📋' },
  { href: '/orders/new', label: 'New Order', icon: '➕' },
];

export default function Sidebar() {
  return (
    <SharedSidebar
      title="Sales Portal"
      subtitle="Order Management"
      navItems={navItems}
    />
  );
}
