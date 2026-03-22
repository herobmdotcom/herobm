'use client';

import SharedSidebar from '@/components/shared/Sidebar';
import type { NavSection } from '@/components/shared/Sidebar';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';

export default function Sidebar() {
  const t = useTranslations('sidebar');
  const tInventory = useTranslations('inventory');
  const { role } = useAuth();

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
        { 
          href: '/inventory', 
          label: t('items.inventory'), 
          icon: 'inventory_2',
          subItems: [
            { href: '/inventory', label: tInventory('tabs.products') },
            { href: '/inventory/bins', label: tInventory('tabs.binContents') },
            { href: '/inventory/movements', label: t('items.movements') }
          ]
        },
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

  // Finance section — visible only to admin and finance roles
  if (role === 'admin' || role === 'finance') {
    sections.push({
      label: t('groups.finance'),
      items: [
        { href: '/gl/trial-balance', label: t('items.trialBalance'), icon: 'account_balance' },
        { href: '/gl/general-ledger', label: t('items.generalLedger'), icon: 'menu_book' },
        { href: '/gl/journal-entries', label: t('items.journalEntries'), icon: 'edit_note' },
      ],
    });
  }

  // Admin section — visible only to admin role
  if (role === 'admin') {
    sections.push({
      label: t('groups.admin'),
      items: [
        { href: '/admin/event-queue', label: t('items.eventQueue'), icon: 'sync' },
      ],
    });
  }

  return (
    <SharedSidebar
      title={t('title')}
      subtitle={t('subtitle')}
      sections={sections}
      footer={t('footer')}
    />
  );
}
