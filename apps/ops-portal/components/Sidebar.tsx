'use client';

import SharedSidebar from '@/components/shared/Sidebar';
import type { NavSection } from '@/components/shared/Sidebar';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';
import { useLicense } from '@/components/LicenseProvider';

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
            { href: '/inventory/ledger', label: tInventory('tabs.ledger') },
            { href: '/inventory/locations', label: tInventory('tabs.locations') },
            { href: '/inventory/transfers', label: t('items.transfers') },
            { href: '/inventory/quarantine', label: t('items.quarantine') }
          ]
        },
        { 
          href: '/receiving', 
          label: t('items.receiving'), 
          icon: 'move_to_inbox',
          subItems: [
            { href: '/receiving', label: 'Supplier Receipts' },
            { href: '/receiving/returns', label: 'Customer Returns' }
          ]
        },
        { href: '/inventory/putaway', label: 'Putaway', icon: 'pallet' },
        { href: '/inventory/picking', label: t('items.picking'), icon: 'inventory' },
        { 
          href: '/inventory/shipping', 
          label: t('items.shipping'), 
          icon: 'local_shipping',
          subItems: [
            { href: '/inventory/shipping', label: 'Customer Shipments' },
            { href: '/shipments/returns', label: 'Supplier Returns' }
          ]
        },
      ],
    },
    {
      label: t('groups.sales'),
      items: [
        { href: '/customers', label: t('items.customers'), icon: 'storefront' },
        { href: '/sales-orders', label: t('items.salesOrders'), icon: 'receipt_long' },
        { href: '/shipments', label: t('items.shipments'), icon: 'local_post_office' },
        { href: '/sales-invoices', label: t('items.salesInvoices'), icon: 'request_quote' },
      ],
    },
    {
      label: t('groups.purchasing'),
      items: [
        { href: '/suppliers', label: t('items.suppliers'), icon: 'factory' },
        { href: '/purchase-orders/demands', label: t('items.demand'), icon: 'list_alt' },
        { href: '/purchase-orders', label: t('items.purchaseOrders'), icon: 'local_shipping' },
        { href: '/supplier-invoices', label: t('items.supplierInvoices'), icon: 'request_quote' },
      ],
    },
  ];

  // Finance section — visible only to admin and finance roles
  if (role === 'admin' || role === 'finance') {
    sections.push({
      label: t('groups.finance'),
      items: [
        { 
          href: '/sales-credit-notes', 
          label: 'Credit Notes', 
          icon: 'receipt_long',
          subItems: [
            { href: '/sales-credit-notes', label: 'Returns Queue' },
            { href: '/sales-credit-notes/history', label: 'History' },
          ]
        },
        { 
          href: '/general-ledger', 
          label: t('items.generalLedger'), 
          icon: 'menu_book',
          subItems: [
            { href: '/general-ledger', label: t('items.generalLedger') },
            { href: '/general-ledger/trial-balance', label: t('items.trialBalance') },
            { href: '/general-ledger/journal-entries', label: t('items.journalEntries') },
          ]
        },
        { href: '/payments', label: 'Payments', icon: 'account_balance_wallet' },
        { 
          href: '/reconciliations', 
          label: 'Bank Rec\'n', 
          icon: 'compare_arrows',
          subItems: [
            { href: '/reconciliations', label: 'Statements' },
            { href: '/reconciliations/profiles', label: 'Import Profiles' },
            { href: '/reconciliations/rules', label: 'Rules' },
          ]
        },
      ],
    });
  }

  // Reporting section — visible to admin and finance/sales/etc. based on roles later
  if (role === 'admin' || role === 'finance') {
    sections.push({
      label: 'Reporting',
      items: [
        { 
          href: '/reporting', 
          label: 'Reports', 
          icon: 'bar_chart',
          subItems: [
            { href: '/reporting', label: 'View Reports' },
            { href: '/reporting/config', label: 'Configuration' },
          ]
        },
      ],
    });
  }

  // Admin section — visible only to admin role
  if (role === 'admin') {
    sections.push({
      label: t('groups.admin'),
      items: [
        { 
          href: '/admin/pdf-templates', 
          label: 'PDF Templates', 
          icon: 'picture_as_pdf',
          subItems: [
            { href: '/admin/pdf-templates', label: 'Templates' },
            { href: '/admin/pdf-templates/hooks', label: 'Hooks' },
          ]
        },
        { 
          href: '/admin/customer-groups', 
          label: 'Groups', 
          icon: 'folder_shared',
          subItems: [
            { href: '/admin/customer-groups', label: 'Customer Groups' },
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
            { href: '/admin/settings/integrations', label: 'Integrations' },
          ]
        },
        { 
          href: '/admin/users', 
          label: t('items.users'), 
          icon: 'group',
          subItems: [
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/users/roles', label: 'Roles & Permissions' },
          ]
        },
        { 
          href: '/admin/developers', 
          label: 'Developers', 
          icon: 'code',
          subItems: [
            { href: '/admin/developers', label: 'Configuration' },
            { href: '/admin/developers/api-reference', label: 'Docs: API' },
            { href: '/admin/developers/webhooks-api', label: 'Docs: Webhooks' },
          ]
        },
        { 
          href: '/admin/import/csv', 
          label: 'Import', 
          icon: 'cloud_upload',
          subItems: [
            { href: '/admin/import/csv', label: 'CSV Upload' },
            { href: '/admin/import/abm', label: 'ABM Database' },
            { href: '/admin/import/odoo', label: 'Odoo Database' },
          ]
        },
      ],
    });
  }

  const { status, isLoading } = useLicense();
  let footerText = process.env.BUILD_TIME || 'Unknown Build';
  
  if (!isLoading && status) {
    if (status.licenseHash) {
      footerText = `License: ${status.licenseHash}`;
    } else if (status.systemId) {
      footerText = `SysID: ${status.systemId.substring(0, 8)}`;
    }
  }

  return (
    <SharedSidebar
      title={t('title')}
      subtitle={t('subtitle')}
      sections={sections}
      footer={footerText}
    />
  );
}
