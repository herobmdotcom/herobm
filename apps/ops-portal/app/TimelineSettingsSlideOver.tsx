'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';

export type EventType = 
  | 'so_created' | 'so_confirmed' | 'so_shipped' | 'so_invoiced'
  | 'po_created' | 'po_ordered' | 'po_received'
  | 'account_created' | 'supplier_created';

export const DEFAULT_ENABLED_EVENTS: EventType[] = [
  'so_created', 'so_confirmed', 'so_shipped', 'so_invoiced',
  'po_created', 'po_ordered', 'po_received',
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
          <OptionRow event="so_invoiced" />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50" style={{ color: 'var(--text-primary)' }}>
            {tSidebar('purchasing')}
          </div>
          <OptionRow event="supplier_created" />
          <OptionRow event="po_created" />
          <OptionRow event="po_ordered" />
          <OptionRow event="po_received" />
        </div>

      </div>
    </SlideOver>
  );
}
