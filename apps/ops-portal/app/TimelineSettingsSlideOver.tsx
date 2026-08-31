'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

export type EventType = string;

export const DEFAULT_ENABLED_EVENTS: EventType[] = [
  'sales_order.created',
  'sales_order.status_changed',
  'sales_order.deleted',
  'purchase_order.created',
  'purchase_order.status_changed',
  'purchase_order.deleted',
  'warehouse.receipt_created',
  'inventory_ledger.entry_posted',
  'transfer_order.created',
  'payment.submitted',
  'general_ledger.integrity_violation',
  'customer.created',
  'supplier.created',
  'product.created',
  'work_order.created',
  'stock_adjusted',
  'email.queued',
  'email.sent',
  'email.failed',
];

export const ALL_AVAILABLE_EVENTS: EventType[] = [
  // Sales
  'customer.created',
  'customer.updated',
  'customer.status_changed',
  'sales_order.created',
  'sales_order.status_changed',
  'sales_order.deleted',
  'sales_order.credit_note_posted',
  'sales_invoice.created',
  'sales_invoice.status_changed',
  'sales_invoice.credit_note_posted',
  'sales_return.created',
  'sales_return.status_changed',
  // Purchasing
  'supplier.created',
  'supplier.updated',
  'supplier.status_changed',
  'purchase_order.created',
  'purchase_order.status_changed',
  'purchase_order.deleted',
  'purchase_order.debit_note_created',
  'purchase_order.debit_note_posted',
  'purchase_invoice.created',
  'purchase_invoice.status_changed',
  'purchase_return.created',
  'purchase_return.status_changed',
  // Inventory
  'product.created',
  'product.updated',
  'product.status_changed',
  'warehouse.receipt_created',
  'warehouse.receipt_status_changed',
  'warehouse.shipment_created',
  'warehouse.shipment_status_changed',
  'warehouse.shipment_dispatched',
  'inventory_ledger.entry_posted',
  'transfer_order.created',
  'transfer_order.status_changed',
  'transfer_order.stock_dispatched',
  'stock_adjusted',
  // Manufacturing
  'work_order.created',
  'work_order.status_changed',
  'work_order.updated',
  'work_order_pick.created',
  'work_order_pick.status_changed',
  // CRM
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'project.created',
  'project.updated',
  'project.deleted',
  'actor.created',
  'actor.updated',
  // Finance
  'payment.created',
  'payment.submitted',
  'payment.allocated',
  'payment.cancelled',
  'general_ledger.entry_posted',
  'general_ledger.integrity_violation',
  'gl_reconciliation.created',
  'gl_reconciliation.deleted',
  'fiscal_period.created',
  'fiscal_period.status_changed',
  // Admin
  'email.queued',
  'email.sent',
  'email.failed',
  'user.created',
  'user.updated',
  'user.status_changed',
  'api_key.created',
  'api_key.deleted',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enabledEvents: EventType[];
  onChange: (events: EventType[]) => void;
}

export default function TimelineSettingsSlideOver({
  isOpen,
  onClose,
  enabledEvents,
  onChange,
}: Props) {
  const t = useTranslations('dashboard.timeline');
  const tSearch = useTranslations('dashboard.search');
  const tSidebar = useTranslations('sidebar.groups');

  const toggleEvent = (event: EventType) => {
    if (enabledEvents.includes(event)) {
      onChange(enabledEvents.filter((e) => e !== event));
    } else {
      onChange([...enabledEvents, event]);
    }
  };

  const handleSelectAll = () => {
    onChange([...ALL_AVAILABLE_EVENTS]);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleResetDefaults = () => {
    onChange([...DEFAULT_ENABLED_EVENTS]);
  };

  const OptionRow = ({ event }: { event: EventType }) => {
    const isChecked = enabledEvents.includes(event);
    return (
      <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggleEvent(event)}
          className="w-4 h-4 rounded text-accent focus:ring-accent"
        />
        <span className="text-[14px] text-[var(--text-primary)]">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl dynamic key */}
          {t(`types.${event}` as any)}
        </span>
      </label>
    );
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={t('settings')}>
      <div className="flex flex-col gap-6">
        <p className="text-[13px] opacity-70 text-[var(--text-primary)]">
          {t('configureInfo')}
        </p>

        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[var(--border)]">
          <Button variant="secondary" size="sm" onClick={handleSelectAll}>
            {tSearch('selectAll')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDeselectAll}>
            {tSearch('deselectAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
            {tSearch('resetToDefault')}
          </Button>
        </div>

        {/* Sales */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('sales')}
          </div>
          <OptionRow event="customer.created" />
          <OptionRow event="customer.updated" />
          <OptionRow event="customer.status_changed" />
          <OptionRow event="sales_order.created" />
          <OptionRow event="sales_order.status_changed" />
          <OptionRow event="sales_order.deleted" />
          <OptionRow event="sales_order.credit_note_posted" />
          <OptionRow event="sales_invoice.created" />
          <OptionRow event="sales_invoice.status_changed" />
          <OptionRow event="sales_invoice.credit_note_posted" />
          <OptionRow event="sales_return.created" />
          <OptionRow event="sales_return.status_changed" />
        </div>

        {/* Purchasing */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('purchasing')}
          </div>
          <OptionRow event="supplier.created" />
          <OptionRow event="supplier.updated" />
          <OptionRow event="supplier.status_changed" />
          <OptionRow event="purchase_order.created" />
          <OptionRow event="purchase_order.status_changed" />
          <OptionRow event="purchase_order.deleted" />
          <OptionRow event="purchase_order.debit_note_created" />
          <OptionRow event="purchase_order.debit_note_posted" />
          <OptionRow event="purchase_invoice.created" />
          <OptionRow event="purchase_invoice.status_changed" />
          <OptionRow event="purchase_return.created" />
          <OptionRow event="purchase_return.status_changed" />
        </div>

        {/* Inventory */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('inventory')}
          </div>
          <OptionRow event="product.created" />
          <OptionRow event="product.updated" />
          <OptionRow event="product.status_changed" />
          <OptionRow event="warehouse.receipt_created" />
          <OptionRow event="warehouse.receipt_status_changed" />
          <OptionRow event="warehouse.shipment_created" />
          <OptionRow event="warehouse.shipment_status_changed" />
          <OptionRow event="warehouse.shipment_dispatched" />
          <OptionRow event="inventory_ledger.entry_posted" />
          <OptionRow event="transfer_order.created" />
          <OptionRow event="transfer_order.status_changed" />
          <OptionRow event="transfer_order.stock_dispatched" />
          <OptionRow event="stock_adjusted" />
        </div>

        {/* Manufacturing */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            Manufacturing
          </div>
          <OptionRow event="work_order.created" />
          <OptionRow event="work_order.status_changed" />
          <OptionRow event="work_order.updated" />
          <OptionRow event="work_order_pick.created" />
          <OptionRow event="work_order_pick.status_changed" />
        </div>

        {/* CRM */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            CRM
          </div>
          <OptionRow event="contact.created" />
          <OptionRow event="contact.updated" />
          <OptionRow event="contact.deleted" />
          <OptionRow event="project.created" />
          <OptionRow event="project.updated" />
          <OptionRow event="project.deleted" />
          <OptionRow event="actor.created" />
          <OptionRow event="actor.updated" />
        </div>

        {/* Finance */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('finance')}
          </div>
          <OptionRow event="payment.created" />
          <OptionRow event="payment.submitted" />
          <OptionRow event="payment.allocated" />
          <OptionRow event="payment.cancelled" />
          <OptionRow event="general_ledger.entry_posted" />
          <OptionRow event="general_ledger.integrity_violation" />
          <OptionRow event="gl_reconciliation.created" />
          <OptionRow event="gl_reconciliation.deleted" />
          <OptionRow event="fiscal_period.created" />
          <OptionRow event="fiscal_period.status_changed" />
        </div>

        {/* Admin */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('admin')}
          </div>
          <OptionRow event="email.queued" />
          <OptionRow event="email.sent" />
          <OptionRow event="email.failed" />
          <OptionRow event="user.created" />
          <OptionRow event="user.updated" />
          <OptionRow event="user.status_changed" />
          <OptionRow event="api_key.created" />
          <OptionRow event="api_key.deleted" />
          <OptionRow event="webhook.created" />
          <OptionRow event="webhook.updated" />
          <OptionRow event="webhook.deleted" />
        </div>
      </div>
    </SlideOver>
  );
}
