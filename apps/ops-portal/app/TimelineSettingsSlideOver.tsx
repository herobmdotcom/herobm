'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';

export type EventType = 
  | 'so_created' | 'so_confirmed' | 'so_shipped' | 'so_invoiced'
  | 'so_dispatched' | 'so_credit_note' | 'so_backorders'
  | 'po_created' | 'po_ordered' | 'po_received'
  | 'po_invoiced' | 'po_over_received' | 'po_price_discrepancy'
  | 'stock_received' | 'stock_adjusted' | 'transfer_created'
  | 'payment_submitted' | 'payment_allocated' | 'payment_cancelled'
  | 'account_created' | 'supplier_created';

export const DEFAULT_ENABLED_EVENTS: EventType[] = [
  'so_created', 'so_confirmed', 'so_shipped', 'so_invoiced', 'so_dispatched',
  'po_created', 'po_ordered', 'po_received', 'po_invoiced',
  'stock_received', 'stock_adjusted', 'transfer_created',
  'payment_submitted',
  'account_created', 'supplier_created'
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
          {t(`types.${event}`)}
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
          <OptionRow event="account_created" />
          <OptionRow event="so_created" />
          <OptionRow event="so_confirmed" />
          <OptionRow event="so_shipped" />
          <OptionRow event="so_dispatched" />
          <OptionRow event="so_invoiced" />
          <OptionRow event="so_credit_note" />
          <OptionRow event="so_backorders" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('purchasing')}
          </div>
          <OptionRow event="supplier_created" />
          <OptionRow event="po_created" />
          <OptionRow event="po_ordered" />
          <OptionRow event="po_received" />
          <OptionRow event="po_invoiced" />
          <OptionRow event="po_over_received" />
          <OptionRow event="po_price_discrepancy" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('inventory')}
          </div>
          <OptionRow event="stock_received" />
          <OptionRow event="stock_adjusted" />
          <OptionRow event="transfer_created" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('finance')}
          </div>
          <OptionRow event="payment_submitted" />
          <OptionRow event="payment_allocated" />
          <OptionRow event="payment_cancelled" />
        </div>

      </div>
    </SlideOver>
  );
}
