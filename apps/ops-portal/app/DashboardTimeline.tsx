'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { EventType } from './TimelineSettingsSlideOver';
import Link from 'next/link';

interface TimelineEvent {
  eventId: string;
  eventType: string;
  entityId: string;
  entityDisplay: string;
  actor: string | null;
  timestamp: string;
}

interface Props {
  enabledEvents: EventType[];
}

const EVENT_ICONS: Record<string, { icon: string, color: string, bg: string, path: string }> = {
  'sales_order.created': { icon: 'add_circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', path: '/sales-orders' },
  'sales_order.status_changed': { icon: 'check_circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', path: '/sales-orders' },
  'sales_invoice.created': { icon: 'receipt_long', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', path: '/sales-invoices' },
  'sales_invoice.status_changed': { icon: 'check_circle', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', path: '/sales-invoices' },
  
  'purchase_order.created': { icon: 'add_shopping_cart', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', path: '/purchase-orders' },
  'purchase_order.status_changed': { icon: 'inventory_2', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', path: '/purchase-orders' },
  'purchase_invoice.created': { icon: 'receipt', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', path: '/supplier-invoices' },
  
  'customer.created': { icon: 'person_add', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', path: '/customers' },
  'customer.updated': { icon: 'manage_accounts', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', path: '/customers' },
  
  'supplier.created': { icon: 'domain_add', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', path: '/suppliers' },
  'supplier.updated': { icon: 'domain', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', path: '/suppliers' },
  
  'warehouse.receipt_created': { icon: 'inventory', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', path: '/receiving' },
  'warehouse.shipment_created': { icon: 'local_shipping', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', path: '/shipments' },
  'warehouse.shipment_dispatched': { icon: 'flight_takeoff', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', path: '/shipments' },
  
  'inventory_ledger.adjustment_processed': { icon: 'exposure', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', path: '/inventory' },
  'transfer_order.created': { icon: 'sync_alt', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', path: '/inventory' },
  
  'payment.submitted': { icon: 'payments', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)', path: '/payments' },
  'payment.allocated': { icon: 'account_balance', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)', path: '/payments' },
  'general_ledger.entry_posted': { icon: 'menu_book', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', path: '/general-ledger' },
};

function getEventStyle(eventType: string) {
  return EVENT_ICONS[eventType] || { icon: 'event', color: 'var(--text-primary)', bg: 'var(--bg-hover)', path: '#' };
}

function formatRelativeTime(dateString: string, t: any) {
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return t('relativeUnits.justNow');
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return t('relativeUnits.m', { count: diffMins });
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return t('relativeUnits.h', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  return t('relativeUnits.d', { count: diffDays });
}

export default function DashboardTimeline({ enabledEvents }: Props) {
  const t = useTranslations('dashboard.timeline');
  const tCommon = useTranslations('common');

  const [data, setData] = React.useState<{ events: TimelineEvent[] } | null>(null);
  const [error, setError] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let mounted = true;

    async function fetchTimeline() {
      try {
        const result = await api.dashboardControllerGetTimeline({ types: enabledEvents.join(','), limit: '20' });
        if (mounted) {
          setData(result.data as unknown as { events: TimelineEvent[] });
          setError(false);
        }
      } catch (err) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    // Initial fetch
    fetchTimeline();

    // Polling interval
    const interval = setInterval(fetchTimeline, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabledEvents]);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500 rounded-lg" style={{ background: 'var(--bg-card)' }}>{t('errors.failedToLoad')}</div>;
  }

  const events = data?.events || [];

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-[14px] opacity-60 rounded-2xl border flex flex-col items-center justify-center gap-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-[32px] opacity-50">history</span>
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {events.map((evt: TimelineEvent) => {
        const style = getEventStyle(evt.eventType);
        const relativeTime = formatRelativeTime(evt.timestamp, t);
        
        return (
          <Link 
            key={evt.eventId} 
            href={`${style.path}/${evt.entityId}`}
            className="group flex gap-4 p-4 rounded-xl transition-all hover:scale-[1.01] hover:shadow-md border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: style.bg, color: style.color }}
            >
              <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold text-[14px] truncate group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {evt.entityDisplay}
                </div>
                <div className="text-[12px] opacity-50 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {relativeTime}
                </div>
              </div>
              
              <div className="text-[13px] opacity-80 mt-1" style={{ color: 'var(--text-muted)' }}>
                {t(('types.' + evt.eventType) as Parameters<typeof t>[0])}
                {evt.actor && (
                  <span className="opacity-70 ml-1">
                    {tCommon('by')} {evt.actor}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
