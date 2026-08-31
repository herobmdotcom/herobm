'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { EventType } from './TimelineSettingsSlideOver';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';

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

export const EVENT_ICONS: Record<
  string,
  { icon: string; colorClass: string; bgClass: string; path: string }
> = {
  // Sales
  'sales_order.created': { icon: 'add_circle', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-orders' },
  'sales_order.status_changed': { icon: 'check_circle', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-orders' },
  'sales_order.deleted': { icon: 'cancel', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/sales-orders' },
  'sales_order.credit_note_posted': { icon: 'credit_card', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-credit-notes' },
  'sales_invoice.created': { icon: 'receipt_long', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-invoices' },
  'sales_invoice.status_changed': { icon: 'check_circle', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-invoices' },
  'sales_invoice.credit_note_posted': { icon: 'credit_card', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-credit-notes' },
  'sales_return.created': { icon: 'assignment_return', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-returns' },
  'sales_return.status_changed': { icon: 'published_with_changes', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/sales-returns' },
  'customer.created': { icon: 'person_add', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/customers' },
  'customer.updated': { icon: 'manage_accounts', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/customers' },
  'customer.status_changed': { icon: 'published_with_changes', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/customers' },

  // Purchasing
  'purchase_order.created': { icon: 'add_shopping_cart', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-orders' },
  'purchase_order.status_changed': { icon: 'inventory_2', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-orders' },
  'purchase_order.deleted': { icon: 'cancel', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/purchase-orders' },
  'purchase_order.debit_note_created': { icon: 'request_quote', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-debit-notes' },
  'purchase_order.debit_note_posted': { icon: 'price_check', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-debit-notes' },
  'purchase_invoice.created': { icon: 'receipt', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/supplier-invoices' },
  'purchase_invoice.status_changed': { icon: 'check_circle', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/supplier-invoices' },
  'purchase_return.created': { icon: 'assignment_return', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-orders/returns' },
  'purchase_return.status_changed': { icon: 'published_with_changes', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/purchase-orders/returns' },
  'supplier.created': { icon: 'domain_add', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', path: '/suppliers' },
  'supplier.updated': { icon: 'domain', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', path: '/suppliers' },
  'supplier.status_changed': { icon: 'published_with_changes', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', path: '/suppliers' },

  // Inventory
  'product.created': { icon: 'category', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/products' },
  'product.updated': { icon: 'edit', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/products' },
  'product.status_changed': { icon: 'published_with_changes', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/products' },
  'warehouse.receipt_created': { icon: 'inventory', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', path: '/receiving' },
  'warehouse.receipt_status_changed': { icon: 'published_with_changes', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', path: '/receiving' },
  'warehouse.shipment_created': { icon: 'local_shipping', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', path: '/shipments' },
  'warehouse.shipment_status_changed': { icon: 'published_with_changes', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', path: '/shipments' },
  'warehouse.shipment_dispatched': { icon: 'flight_takeoff', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', path: '/shipments' },
  'inventory_ledger.entry_posted': { icon: 'exposure', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/inventory/ledger?entryId=' },
  'transfer_order.created': { icon: 'sync_alt', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10', path: '/inventory/transfers' },
  'transfer_order.status_changed': { icon: 'published_with_changes', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10', path: '/inventory/transfers' },
  'transfer_order.stock_dispatched': { icon: 'local_shipping', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10', path: '/inventory/transfers' },
  'stock_adjusted': { icon: 'tune', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', path: '/inventory/ledger?entryId=' },

  // Manufacturing
  'work_order.created': { icon: 'build', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/manufacturing/work-orders' },
  'work_order.status_changed': { icon: 'published_with_changes', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/manufacturing/work-orders' },
  'work_order.updated': { icon: 'edit_note', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/manufacturing/work-orders' },
  'work_order_pick.created': { icon: 'conveyor_belt', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/manufacturing/work-orders' },
  'work_order_pick.status_changed': { icon: 'check_circle', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10', path: '/manufacturing/work-orders' },

  // CRM
  'contact.created': { icon: 'contacts', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/crm/contacts' },
  'contact.updated': { icon: 'edit', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/crm/contacts' },
  'contact.deleted': { icon: 'delete', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/crm/contacts' },
  'project.created': { icon: 'folder', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10', path: '/crm/projects' },
  'project.updated': { icon: 'folder_open', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10', path: '/crm/projects' },
  'project.deleted': { icon: 'folder_delete', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/crm/projects' },
  'actor.created': { icon: 'business', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/crm/actors' },
  'actor.updated': { icon: 'edit', colorClass: 'text-purple-500', bgClass: 'bg-purple-500/10', path: '/crm/actors' },

  // Finance
  'payment.created': { icon: 'add_card', colorClass: 'text-teal-500', bgClass: 'bg-teal-500/10', path: '/payments?paymentId=' },
  'payment.submitted': { icon: 'payments', colorClass: 'text-teal-500', bgClass: 'bg-teal-500/10', path: '/payments?paymentId=' },
  'payment.allocated': { icon: 'account_balance', colorClass: 'text-teal-500', bgClass: 'bg-teal-500/10', path: '/payments?paymentId=' },
  'payment.cancelled': { icon: 'cancel', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/payments?paymentId=' },
  'general_ledger.entry_posted': { icon: 'menu_book', colorClass: 'text-slate-500', bgClass: 'bg-slate-500/10', path: '/general-ledger' },
  'general_ledger.integrity_violation': { icon: 'error_outline', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/general-ledger' },
  'system.ledger_integrity_violation': { icon: 'error_outline', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/general-ledger' },
  'gl_reconciliation.created': { icon: 'compare_arrows', colorClass: 'text-teal-500', bgClass: 'bg-teal-500/10', path: '/reconciliations' },
  'gl_reconciliation.deleted': { icon: 'delete', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/reconciliations' },
  'fiscal_period.created': { icon: 'calendar_month', colorClass: 'text-slate-500', bgClass: 'bg-slate-500/10', path: '/fiscal-periods' },
  'fiscal_period.status_changed': { icon: 'lock', colorClass: 'text-slate-500', bgClass: 'bg-slate-500/10', path: '/fiscal-periods' },

  // Admin
  'email.queued': { icon: 'mail', colorClass: 'text-sky-500', bgClass: 'bg-sky-500/10', path: '/admin/email/outbox' },
  'email.sent': { icon: 'mark_email_read', colorClass: 'text-sky-500', bgClass: 'bg-sky-500/10', path: '/admin/email/outbox' },
  'email.failed': { icon: 'mail_lock', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/admin/email/outbox' },
  'user.created': { icon: 'person_add', colorClass: 'text-cyan-500', bgClass: 'bg-cyan-500/10', path: '/admin/users' },
  'user.updated': { icon: 'manage_accounts', colorClass: 'text-cyan-500', bgClass: 'bg-cyan-500/10', path: '/admin/users' },
  'user.status_changed': { icon: 'published_with_changes', colorClass: 'text-cyan-500', bgClass: 'bg-cyan-500/10', path: '/admin/users' },
  'api_key.created': { icon: 'key', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', path: '/admin/developers' },
  'api_key.deleted': { icon: 'key_off', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/admin/developers' },
  'webhook.created': { icon: 'webhook', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/admin/developers' },
  'webhook.updated': { icon: 'edit', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', path: '/admin/developers' },
  'webhook.deleted': { icon: 'delete', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', path: '/admin/developers' },
};

function getEventStyle(eventType: string) {
  return (
    EVENT_ICONS[eventType] || {
      icon: 'event',
      colorClass: 'text-[var(--text-primary)]',
      bgClass: 'bg-[var(--bg-hover)]',
      path: '#',
    }
  );
}

function formatRelativeTime(dateString: string, t: ReturnType<typeof useTranslations>) {
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60)
    return (
      t as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Required because next-intl generic types result in deep instantiation errors */
    )('relativeUnits.justNow');
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60)
    return (
      t as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Required because next-intl generic types result in deep instantiation errors */
    )('relativeUnits.m', { count: diffMins });
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)
    return (
      t as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Required because next-intl generic types result in deep instantiation errors */
    )('relativeUnits.h', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  return (
    t as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Required because next-intl generic types result in deep instantiation errors */
  )('relativeUnits.d', { count: diffDays });
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
        const result = await api.dashboardControllerGetTimeline({
          types: enabledEvents.join(','),
          limit: '20',
        });
        if (mounted) {
          setData(result.data as unknown as { events: TimelineEvent[] });
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchTimeline();

    const interval = setInterval(fetchTimeline, 120000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabledEvents]);

  const handleRetry = React.useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const result = await api.dashboardControllerGetTimeline({
        types: enabledEvents.join(','),
        limit: '20',
      });
      setData(result.data as unknown as { events: TimelineEvent[] });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [enabledEvents]);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl border flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)] border-[var(--border)] text-center">
        {/* eslint-disable-next-line i18next/no-literal-string -- Material symbol icon name */}
        <span className="material-symbols-outlined text-[32px] text-red-500">error</span>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('errors.failedToLoad' as Parameters<typeof t>[0])}
        </p>
        <Button variant="secondary" size="sm" onClick={handleRetry}>
          {t('errors.retry' as Parameters<typeof t>[0])}
        </Button>
      </div>
    );
  }

  const events = data?.events || [];

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-[14px] opacity-60 rounded-2xl border flex flex-col items-center justify-center gap-2 bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]">
        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
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
            href={
              style.path.includes('?')
                ? `${style.path}${evt.entityId}`
                : `${style.path}/${evt.entityId}`
            }
            className="group flex gap-4 p-4 rounded-xl transition-all hover:scale-[1.01] border bg-[var(--bg-card)] border-[var(--border)]"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${style.bgClass} ${style.colorClass}`}
            >
              <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold text-[14px] truncate group-hover:text-accent transition-colors text-[var(--text-primary)]">
                  {evt.entityDisplay}
                </div>
                <div className="text-[12px] opacity-50 whitespace-nowrap text-[var(--text-muted)]">
                  {relativeTime}
                </div>
              </div>

              <div className="text-[13px] opacity-80 mt-1 text-[var(--text-muted)]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic translation lookup */}
                {t(('types.' + evt.eventType) as any)}
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
