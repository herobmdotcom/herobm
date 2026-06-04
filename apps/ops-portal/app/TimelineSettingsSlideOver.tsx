'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';

export type EventType = string;

export const DEFAULT_ENABLED_EVENTS: EventType[] = [
  'sales_order.created', 'sales_order.status_changed', 'sales_order.deleted',
  'purchase_order.created', 'purchase_order.status_changed', 'purchase_order.deleted',
  'warehouse.receipt_created', 'inventory_ledger.entry_posted', 'transfer_order.created',
  'payment.submitted',
  'customer.created', 'supplier.created'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enabledEvents: EventType[];
  onChange: (events: EventType[]) => void;
}

export default function TimelineSettingsSlideOver({ isOpen, onClose, enabledEvents, onChange }: Props) {
  const t = useTranslations('dashboard.timeline');
  const tSidebar = useTranslations('sidebar.groups');

  const toggleEvent = (event: EventType) => {
    if (enabledEvents.includes(event)) {
      onChange(enabledEvents.filter(e => e !== event));
    } else {
      onChange([...enabledEvents, event]);
    }
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
        <span className="text-[14px]" style={{ color: 'var(--text-primary)' }}>
          {t(`types.${event}` as any)}
        </span>
      </label>
    );
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={t('settings')}>
      <div className="flex flex-col gap-6">
        <p className="text-[13px] opacity-70" style={{ color: 'var(--text-primary)' }}>
          {t('configureInfo')}
        </p>
        
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('sales')}
          </div>
          <OptionRow event="customer.created" />
          <OptionRow event="customer.updated" />
          <OptionRow event="sales_order.created" />
          <OptionRow event="sales_order.status_changed" />
          <OptionRow event="sales_order.deleted" />
          <OptionRow event="sales_invoice.created" />
          <OptionRow event="sales_invoice.status_changed" />
          <OptionRow event="sales_return.created" />
          <OptionRow event="sales_return.status_changed" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('purchasing')}
          </div>
          <OptionRow event="supplier.created" />
          <OptionRow event="supplier.updated" />
          <OptionRow event="purchase_order.created" />
          <OptionRow event="purchase_order.status_changed" />
          <OptionRow event="purchase_order.deleted" />
          <OptionRow event="purchase_invoice.created" />
          <OptionRow event="purchase_invoice.status_changed" />
          <OptionRow event="purchase_return.created" />
          <OptionRow event="purchase_return.status_changed" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('inventory')}
          </div>
          <OptionRow event="warehouse.receipt_created" />
          <OptionRow event="warehouse.receipt_status_changed" />
          <OptionRow event="warehouse.shipment_created" />
          <OptionRow event="warehouse.shipment_status_changed" />
          <OptionRow event="warehouse.shipment_dispatched" />
          <OptionRow event="inventory_ledger.entry_posted" />
          <OptionRow event="transfer_order.created" />
          <OptionRow event="transfer_order.status_changed" />
          <OptionRow event="stock_adjusted" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('finance')}
          </div>
          <OptionRow event="payment.submitted" />
          <OptionRow event="payment.allocated" />
          <OptionRow event="payment.cancelled" />
          <OptionRow event="general_ledger.entry_posted" />
        </div>

      </div>
    </SlideOver>
  );
}
