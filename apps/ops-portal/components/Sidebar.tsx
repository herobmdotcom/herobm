'use client';

import SharedSidebar from '@/components/shared/Sidebar';
import type { NavSection } from '@/components/shared/Sidebar';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/AuthGate';
import { SystemResource, hasPermission, hasAnyPermission } from '@herobm/shared';
import { routes } from '@/lib/routes';

export default function Sidebar() {
  const t = useTranslations('sidebar');
  const tInventory = useTranslations('inventory');
  const { permissions } = useAuth();

  const sections: NavSection[] = [
    {
      items: [
        { href: routes.dashboard(), label: t('items.dashboard'), icon: 'dashboard' },
      ],
    },
    {
      label: t('groups.sales'),
      items: [
        { href: routes.customers.list(), label: t('items.customers'), icon: 'storefront' },
        { href: routes.salesQuotes.list(), label: t('items.salesQuotes'), icon: 'request_quote' },
        { href: routes.salesOrders.list(), label: t('items.salesOrders'), icon: 'receipt_long' },
        { href: routes.shipments.list(), label: t('items.shipments'), icon: 'local_post_office' },
        { href: routes.salesInvoices.list(), label: t('items.salesInvoices'), icon: 'request_quote' },
        { href: routes.salesReturns.list(), label: t('items.salesReturns'), icon: 'assignment_return' },
        { href: routes.salesCreditNotes.list(), label: t('items.creditNotes'), icon: 'receipt_long' },
      ],
    },
    {
      label: t('groups.inventory'),
      items: [
        { href: routes.products.list(), label: t('items.products'), icon: 'category' },
        { 
          href: routes.inventory.bins(), 
          label: t('items.inventory'), 
          icon: 'inventory_2',
          subItems: [
            { href: routes.inventory.bins(), label: tInventory('tabs.binContents') },
            { href: routes.inventory.ledger(), label: tInventory('tabs.ledger') },
            { href: routes.inventory.locations(), label: tInventory('tabs.locations') },
            { href: routes.inventory.transfers.list(), label: t('items.transfers') },
            { href: routes.inventory.quarantine(), label: t('items.quarantine') }
          ]
        },
        { 
          href: routes.receiving.list(), 
          label: t('items.receiving'), 
          icon: 'move_to_inbox',
          subItems: [
            { href: routes.receiving.list(), label: 'Supplier Receipts' },
            { href: routes.receiving.returns(), label: 'Customer Returns' },
            { href: routes.receiving.transfers(), label: 'Incoming Transfers' }
          ]
        },
        { href: routes.inventory.putaway(), label: 'Putaway', icon: 'pallet' },
        { href: routes.inventory.picking(), label: t('items.picking'), icon: 'inventory' },
        { 
          href: routes.inventory.shipping(), 
          label: t('items.shipping'), 
          icon: 'local_shipping',
          subItems: [
            { href: routes.inventory.shipping(), label: 'Customer Shipments' },
            { href: routes.shipments.returns(), label: 'Supplier Returns' },
            { href: routes.inventory.scanToDispatch(), label: 'Scan to Dispatch' }
          ]
        },
      ],
    },
    {
      label: t('groups.purchasing'),
      items: [
        { href: routes.suppliers.list(), label: t('items.suppliers'), icon: 'factory' },
        { href: routes.purchaseOrders.demands(), label: t('items.demand'), icon: 'list_alt' },
        { href: routes.purchaseOrders.list(), label: t('items.purchaseOrders'), icon: 'local_shipping' },
        { href: routes.supplierInvoices.list(), label: t('items.supplierInvoices'), icon: 'request_quote' },
        { href: routes.purchaseOrders.returns.list(), label: t('items.purchaseReturns'), icon: 'assignment_return' },
        { href: routes.purchaseDebitNotes.list(), label: t('items.debitNotes'), icon: 'receipt_long' },
      ],
    },
    {
      label: 'Manufacturing',
      items: [
        { href: routes.workOrders.list(), label: 'Work Orders', icon: 'build' },
      ],
    },
    {
      label: 'CRM',
      items: [
        { href: routes.crm.actors.list(), label: 'Actors', icon: 'business' },
        { href: routes.crm.projects.list(), label: 'Projects', icon: 'folder' },
        { href: routes.crm.contacts.list(), label: 'Contacts', icon: 'contacts' },
        { href: routes.crm.map(), label: 'Map', icon: 'map' },
      ],
    },
  ];

  // Finance section
  if (hasAnyPermission(permissions, [SystemResource.GL, SystemResource.FISCAL_PERIODS], 'read')) {
    const financeItems: NavSection['items'] = [];
    if (hasPermission(permissions, SystemResource.GL, 'read')) {
      financeItems.push(
        { 
          href: routes.generalLedger.list(), 
          label: t('items.generalLedger'), 
          icon: 'menu_book',
          subItems: [
            { href: routes.generalLedger.list(), label: t('items.generalLedger') },
            { href: routes.generalLedger.trialBalance(), label: t('items.trialBalance') },
            { href: routes.generalLedger.journalEntries.list(), label: t('items.journalEntries') },
          ]
        },
        { 
          href: routes.balances.customers(), 
          label: 'Balances', 
          icon: 'account_balance',
          subItems: [
            { href: routes.balances.customers(), label: 'Customers' },
            { href: routes.balances.suppliers(), label: 'Suppliers' },
            { href: routes.balances.tax(), label: 'Tax' },
          ]
        },
        { href: routes.payments.list(), label: 'Payments', icon: 'account_balance_wallet' },
        { 
          href: routes.reconciliations.list(), 
          label: 'Bank Rec\'n', 
          icon: 'compare_arrows',
          subItems: [
            { href: routes.reconciliations.list(), label: 'Statements' },
            { href: routes.reconciliations.profiles(), label: 'Import Profiles' },
            { href: routes.reconciliations.rules(), label: 'Rules' },
          ]
        },
      );
    }
    if (hasPermission(permissions, SystemResource.FISCAL_PERIODS, 'read')) {
      financeItems.push({
        href: routes.fiscalPeriods.list(),
        label: t('items.fiscalPeriods'),
        icon: 'calendar_month',
      });
    }
    sections.push({
      label: t('groups.finance'),
      items: financeItems,
    });
  }

  // Reporting section
  if (hasAnyPermission(permissions, [SystemResource.REPORT, SystemResource.BUSINESS_REPORT], 'read')) {
    sections.push({
      label: 'Reporting',
      items: [
        { 
          href: routes.reporting.list(), 
          label: 'Reports', 
          icon: 'bar_chart',
          subItems: [
            { href: routes.reporting.list(), label: 'View Reports' },
            { href: routes.reporting.config.list(), label: 'Configuration' },
          ]
        },
      ],
    });
  }

  // Admin section
  if (hasAnyPermission(permissions, [SystemResource.USERS, SystemResource.ROLES, SystemResource.SETTINGS], 'read')) {
    sections.push({
      label: t('groups.admin'),
      items: [
        { 
          href: routes.admin.customerGroups(), 
          label: 'Groups', 
          icon: 'folder_shared',
          subItems: [
            { href: routes.admin.customerGroups(), label: 'Customer Groups' },
            { href: routes.admin.supplierGroups(), label: 'Supplier Groups' },
            { href: routes.admin.productGroups(), label: 'Product Groups' },
          ]
        },
        { 
          href: routes.admin.settings.system(), 
          label: t('items.settings'), 
          icon: 'settings',
          subItems: [
            { href: routes.admin.settings.crm(), label: 'CRM' },
            { href: routes.admin.settings.financial(), label: t('items.financial') },
            { href: routes.admin.settings.integrations(), label: 'Integrations' },
            { href: routes.admin.settings.license(), label: 'License' },
            { href: routes.admin.settings.pdfHooks(), label: 'PDF Hooks' },
            { href: routes.admin.settings.pdfTemplates.list(), label: 'PDF Templates' },
            { href: routes.admin.settings.system(), label: t('items.system') },
          ]
        },
        { 
          href: routes.admin.users.list(), 
          label: t('items.users'), 
          icon: 'group',
          subItems: [
            { href: routes.admin.users.list(), label: 'Users' },
            { href: routes.admin.users.roles(), label: 'Roles & Permissions' },
          ]
        },
      ],
    });
  }

  // Technical section
  if (hasAnyPermission(permissions, [SystemResource.API_KEYS, SystemResource.WEBHOOKS, SystemResource.IMPORT, SystemResource.SYSTEM_LOGS, SystemResource.EVENTS], 'read')) {
    sections.push({
      label: 'Technical',
      items: [
        { 
          href: routes.admin.developers.list(), 
          label: 'Developers', 
          icon: 'code',
        },
        {
          href: routes.admin.email.outbox(),
          label: 'Email',
          icon: 'mail',
          subItems: [
            { href: routes.admin.email.outbox(), label: 'Outbox' },
            { href: routes.admin.email.settings(), label: 'SMTP Settings' },
          ]
        },
        { 
          href: routes.admin.export.csv(), 
          label: 'Data Transfer', 
          icon: 'swap_horiz',
          subItems: [
            { href: routes.admin.export.csv(), label: 'CSV Export' },
            { href: routes.admin.import.csv(), label: 'CSV Import' },
            { href: routes.admin.import.abm(), label: 'ABM Database' },
            { href: routes.admin.import.odoo(), label: 'Odoo Database' },
          ]
        },
        { 
          href: routes.admin.eventQueue(), 
          label: 'System Health', 
          icon: 'monitor_heart',
          subItems: [
            { href: routes.admin.eventQueue(), label: t('items.eventQueue') },
            { href: routes.admin.systemLogs(), label: t('items.systemLogs') },
            { href: routes.admin.version(), label: t('items.version') },
          ]
        },
      ],
    });
  }

  return (
    <SharedSidebar
      title={t('title')}
      subtitle={t('subtitle')}
      sections={sections}
    />
  );
}
