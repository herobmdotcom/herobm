'use client';

import { Sidebar as SharedSidebar } from '@modbm/portal-ui';
import type { NavSection } from '@modbm/portal-ui';
import { useTranslations } from 'next-intl';

export default function Sidebar() {
  const t = useTranslations('sidebar');

  const sections: NavSection[] = [
    {
      items: [
        { href: '/', label: t('items.dashboard'), icon: '📊' },
      ],
    },
    {
      label: t('groups.inventory'),
      items: [
        { href: '/products', label: t('items.products'), icon: '🏷️' },
        { href: '/inventory', label: t('items.inventory'), icon: '📦' },
        { href: '/bins', label: t('items.bins'), icon: '🗄️' },
      ],
    },
    {
      label: t('groups.sales'),
      items: [
        { href: '/accounts', label: t('items.accounts'), icon: '🏢' },
        { href: '/sales-orders', label: t('items.salesOrders'), icon: '📋' },
      ],
    },
    {
      label: t('groups.purchasing'),
      items: [
        { href: '/suppliers', label: t('items.suppliers'), icon: '🏭' },
        { href: '/purchase-orders', label: t('items.purchaseOrders'), icon: '📦' },
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
