'use client';

import SharedSidebar from '@/components/shared/Sidebar';
import type { NavSection } from '@/components/shared/Sidebar';
import { useTranslations } from 'next-intl';

export default function Sidebar() {
  const t = useTranslations('sidebar');

  const sections: NavSection[] = [
    {
      items: [
        { href: '/', label: t('items.dashboard'), icon: 'dashboard' },
      ],
    },
    {
      label: t('groups.inventory'),
      items: [
        { href: '/products', label: t('items.products'), icon: 'inventory_2' },
        { href: '/inventory', label: t('items.inventory'), icon: 'inventory_2' },
        { href: '/bins', label: t('items.bins'), icon: 'auto_awesome_mosaic' },
      ],
    },
    {
      label: t('groups.sales'),
      items: [
        { href: '/accounts', label: t('items.accounts'), icon: 'storefront' },
        { href: '/sales-orders', label: t('items.salesOrders'), icon: 'receipt_long' },
      ],
    },
    {
      label: t('groups.purchasing'),
      items: [
        { href: '/suppliers', label: t('items.suppliers'), icon: 'factory' },
        { href: '/purchase-orders', label: t('items.purchaseOrders'), icon: 'local_shipping' },
      ],
    },
  ];

  return (
    <SharedSidebar
      title={t('title')}
      subtitle={t('subtitle')}
      sections={sections}
      footer={t('footer')}
    />
  );
}
