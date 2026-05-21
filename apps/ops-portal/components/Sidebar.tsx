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
        { href: '/products', label: t('items.products'), icon: 'category' },
        { 
          href: '/inventory/bins', 
          label: t('items.inventory'), 
          icon: 'inventory_2',
          subItems: [
            { href: '/inventory/bins', label: tInventory('tabs.binContents') },
            { href: '/inventory/movements', label: t('items.movements') },
            { href: '/inventory/ledger', label: tInventory('tabs.ledger', { fallback: 'Ledger' }) },
            { href: '/inventory/locations', label: tInventory('tabs.locations', { defaultValue: 'Locations' }) },
            { href: '/inventory/transfers', label: t('items.transfers', { defaultValue: 'Transfers' }) }
          ]
        },
        { 
          href: '/receiving', 
          label: t('items.receiving', { defaultValue: 'Receiving' }), 
          icon: 'move_to_inbox',
          subItems: [
            { href: '/receiving', label: 'Supplier Receipts' },
            { href: '/receiving/returns', label: 'Customer Returns' }
          ]
        },
        { href: '/inventory/putaway', label: 'Putaway', icon: 'pallet' },
        { href: '/inventory/picking', label: t('items.picking', { defaultValue: 'Picking' }), icon: 'inventory' },
        { href: '/inventory/shipping', label: t('items.shipping', { defaultValue: 'Shipping' }), icon: 'local_shipping' },
      ],
    },
    {
      label: t('groups.sales'),
      items: [
        { href: '/accounts', label: t('items.accounts'), icon: 'storefront' },
        { href: '/sales-orders', label: t('items.salesOrders'), icon: 'receipt_long' },
        { href: '/shipments', label: t('items.shipments', { defaultValue: 'Shipments' }), icon: 'local_post_office' },
        { href: '/sales-invoices', label: t('items.salesInvoices'), icon: 'request_quote' },
      ],
    },
    {
      label: t('groups.purchasing'),
      items: [
        { href: '/suppliers', label: t('items.suppliers'), icon: 'factory' },
        { href: '/purchase-orders/demands', label: t('items.demand'), icon: 'list_alt' },
        { href: '/purchase-orders', label: t('items.purchaseOrders'), icon: 'local_shipping' },
        { href: '/supplier-invoices', label: t('items.supplierInvoices', { defaultValue: 'Supplier Invoices' }), icon: 'request_quote' },
      ],
    },
  ];

  // Finance section — visible only to admin and finance roles
  if (role === 'admin' || role === 'finance') {
    sections.push({
      label: t('groups.finance'),
      items: [
        { 
          href: '/general-ledger', 
          label: t('items.generalLedger'), 
          icon: 'menu_book',
          subItems: [
            { href: '/general-ledger', label: t('items.generalLedger') },
            { href: '/general-ledger/trial-balance', label: t('items.trialBalance') },
            { href: '/general-ledger/journal-entries', label: t('items.journalEntries') },
            { href: '/general-ledger/reconciliations', label: 'Bank Reconciliations' },
          ]
        },
        { href: '/payments', label: 'Payments', icon: 'account_balance_wallet' },
      ],
    });
  }

  // Admin section — visible only to admin role
  if (role === 'admin') {
    sections.push({
      label: t('groups.admin'),
      items: [
        { 
          href: '/admin/reporting', 
          label: 'Reporting', 
          icon: 'architecture',
          subItems: [
            { href: '/admin/reporting', label: 'Templates' },
            { href: '/admin/reporting/hooks', label: 'Hooks' },
          ]
        },
        { 
          href: '/admin/account-groups', 
          label: 'Groups', 
          icon: 'folder_shared',
          subItems: [
            { href: '/admin/account-groups', label: 'Account Groups' },
            { href: '/admin/supplier-groups', label: 'Supplier Groups' },
            { href: '/admin/product-groups', label: 'Product Groups' },
          ]
        },
        { 
          href: '/admin/event-queue', 
          label: 'System Health', 
          icon: 'monitor_heart',
          subItems: [
            { href: '/admin/event-queue', label: t('items.eventQueue') },
            { href: '/admin/system-logs', label: t('items.systemLogs') },
          ]
        },
        { 
          href: '/admin/settings/system', 
          label: t('items.settings'), 
          icon: 'settings',
          subItems: [
            { href: '/admin/settings/system', label: t('items.system') },
            { href: '/admin/settings/financial', label: t('items.financial') },
          ]
        },
        { href: '/admin/users', label: t('items.users'), icon: 'group' },
      ],
    });
  }

  return (
    <SharedSidebar
      title={t('title')}
      subtitle={t('subtitle')}
      sections={sections}
      footer={process.env.BUILD_TIME || 'Unknown Build'}
    />
  );
}
