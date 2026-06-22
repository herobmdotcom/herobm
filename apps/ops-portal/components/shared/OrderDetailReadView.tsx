'use client';

/**
 * OrderDetailReadView — shared read-only order detail component.
 *
 * Renders order header, line items table, totals summary, and activity timeline.
 * Used by both the ops-portal (always read-only) and sales-portal (read-only branch).
 *
 * This component is purely presentational — it does NOT fetch data, manage routing,
 * or perform mutations. The consumer provides everything via props.
 */

import { useTranslations } from 'next-intl';
import { computeOrderTotals } from '@herobm/shared';
import MobileLineItemCard from './MobileLineItemCard';
import EntityBanner from './EntityBanner';

/* ── Type definitions ────────────────────────────────────────────── */

export interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productNumber?: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  amount: string;
  tax: string;
  totalAmount: string;
  unitOfMeasure: string;
  taxCategoryId?: string | null;
}

export interface OrderEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actor: string;
  createdOn: string;
}

export interface OrderDetailData {
  salesOrderId: string | null;
  orderNumber: string;
  name: string | null;
  customerId: string | null;
  customerOrderNumber: string | null;
  stateCode: string;
  currencyCode: string;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;

  isCreditBlocked?: boolean;
  creditHoldOverrideAt?: string | null;
  creditHoldOverrideBy?: string | null;
  creditHoldOverrideReason?: string | null;

  lines: OrderLine[];
  events?: OrderEvent[];
}

export interface OrderDetailReadViewProps {
  /** The order data to render */
  order: OrderDetailData;
  /** Currency formatter — keeps the component independent of currency config */
  formatAmount: (amount: number, currencyCode: string) => string;
  /** Optional content rendered in the header's action area (right side) */
  headerActions?: React.ReactNode;
  /** Optional content rendered below the line items table (e.g. returns section) */
  children?: React.ReactNode;
  /** Action for credit override, passed from parent */
  overrideAction?: React.ReactNode;
}

/* ── Helper components ────────────────────────────────────────────── */

export function StateBadge({ state }: { state: string }) {
  return <span className={`badge badge-${state}`}>{state}</span>;
}

/* ── Main component ───────────────────────────────────────────────── */

export default function OrderDetailReadView({
  order,
  formatAmount,
  headerActions,
  children,
  overrideAction,
}: OrderDetailReadViewProps) {
  const tRV = useTranslations('common.orderReadView');
  const tCols = useTranslations('salesOrders.columns');

  const { subtotal, totalTax, totalAmount: grandTotal } = computeOrderTotals(order.lines);
  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
  const cc = order.currencyCode || 'EUR';

  return (
    <>
      {order.isCreditBlocked && !order.creditHoldOverrideAt && (
        <EntityBanner 
          type="error"
          title="Credit Hold"
          description="This order is currently blocked because the customer's credit limit has been exceeded or they have overdue invoices. Fulfillment is suspended."
          action={overrideAction}
        />
      )}
      
      {order.creditHoldOverrideAt && (
        <EntityBanner 
          type="warning"
          title="Credit Hold Overridden"
          description={`A credit hold override was granted for this order on ${new Date(order.creditHoldOverrideAt).toLocaleString()} by ${order.creditHoldOverrideBy || 'System'}. Reason: ${order.creditHoldOverrideReason || 'Not provided'}`}
          action={overrideAction}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <StateBadge state={order.stateCode} />
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {order.name === order.orderNumber ? null : (order.name || tRV('untitledOrder'))}
          </p>
        </div>
        {headerActions && (
          <div className="flex gap-2">{headerActions}</div>
        )}
      </div>

      {/* ── Order details card (collapsible, open by default) ───── */}
      <details className="card mb-6" open>
        <summary
          className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2"
          style={{
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            listStyle: 'none',
          }}
        >
          <span className="details-chevron" style={{ fontSize: 10, transition: 'transform 200ms' }}>▶</span>
          {tRV('orderDetails')}
        </summary>
        <div className="grid grid-cols-2 gap-y-3 text-sm" style={{ marginTop: 16 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>
              {tRV('customer')}
              {order.currencyCode && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(59,130,246,0.15)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  {order.currencyCode}
                </span>
              )}
            </span>
            <p style={{ fontWeight: 500 }}>{order.customerId || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{tRV('customerPO')}</span>
            <p style={{ fontWeight: 500 }}>{order.customerOrderNumber || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{tRV('orderName')}</span>
            <p style={{ fontWeight: 500 }}>{order.name || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{tRV('created')}</span>
            <p style={{ fontWeight: 500 }}>
              {order.createdOn
                ? new Date(order.createdOn).toLocaleString()
                : '—'}
              {order.createdBy ? ` by ${order.createdBy}` : ''}
            </p>
          </div>
          {order.notes && (
            <div className="col-span-2">
              <span style={{ color: 'var(--text-muted)' }}>{tRV('notes')}</span>
              <p style={{ fontWeight: 500 }}>{order.notes}</p>
            </div>
          )}
        </div>
      </details>

      {/* ── Line items table ────────────────────────────────────── */}
      <div className="card mb-6">
        <h3
          className="text-sm font-semibold mb-4"
          style={{
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {tRV('lineItems')}
        </h3>
        
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="table-lines w-full">
            <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>{tCols('product')}</th>
              <th>{tCols('description')}</th>
              <th style={{ width: 90, textAlign: 'right' }}>{tCols('qty')}</th>
              <th style={{ width: 110, textAlign: 'right' }}>{tCols('unitPrice')}</th>
              <th style={{ width: 80, textAlign: 'right' }}>{tCols('discountPct')}</th>
              <th style={{ width: 110, textAlign: 'right' }}>{tCols('tax')}</th>
              <th style={{ width: 110, textAlign: 'right' }}>{tCols('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.salesOrderLineId}>
                <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                <td style={{ fontWeight: 600, fontSize: 12 }}>
                  {line.productNumber || line.productId?.substring(0, 8) || '—'}
                </td>
                <td>{line.productDescription || '—'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {line.quantity}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(line.pricePerUnit || '0'), cc)}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {line.discountPercentage || '0'}%
                </td>
                <td style={{ textAlign: 'right', fontSize: 12 }}>
                  {(() => {
                    const amt = parseFloat(line.amount || '0');
                    const tax = parseFloat(line.tax || '0');
                    if (amt > 0 && tax > 0) {
                      const pct = (tax / amt) * 100;
                      return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                    }
                    if (amt > 0 && tax === 0) return tRV('exempt');
                    return '—';
                  })()}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatAmount(parseFloat(line.amount || '0'), cc)}
                </td>
              </tr>
            ))}
            {order.lines.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                >
                  {tRV('noLineItems')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

        {/* Mobile Cards */}
        <div className="flex flex-col lg:hidden mt-2">
          {order.lines.map((line, idx) => {
            const hasDiscount = parseFloat(line.discountPercentage || '0') > 0;
            return (
              <MobileLineItemCard
                key={line.salesOrderLineId}
                title={line.productNumber || line.productId?.substring(0, 8) || '—'}
                subtitle={line.productDescription || '—'}
                topRightBadge={`#${line.lineNumber || idx + 1}`}
                details={[
                  {
                    label: tCols('qty'),
                    value: line.quantity
                  },
                  {
                    label: tCols('uom'),
                    value: line.unitOfMeasure || 'EA'
                  },
                  {
                    label: tCols('unitPrice'),
                    value: formatAmount(parseFloat(line.pricePerUnit || '0'), cc)
                  },
                  {
                    label: tCols('discountPct'),
                    value: hasDiscount ? `${line.discountPercentage}%` : '0.0%'
                  },
                  {
                    label: tCols('tax'),
                    value: (() => {
                      const amt = parseFloat(line.amount || '0');
                      const tax = parseFloat(line.tax || '0');
                      if (amt > 0 && tax > 0) {
                        const pct = (tax / amt) * 100;
                        return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                      }
                      if (amt > 0 && tax === 0) return tRV('exempt');
                      return '—';
                    })()
                  },
                  {
                    label: tCols('amount'),
                    value: formatAmount(parseFloat(line.amount || '0'), cc),
                    isHighlighted: true
                  }
                ]}
              />
            );
          })}
          {order.lines.length === 0 && (
            <div className="text-center text-sm text-[var(--text-muted)] py-4 border border-[var(--border)] rounded-lg">
              {tRV('noLineItems')}
            </div>
          )}
        </div>
      </div>

      {/* ── Totals summary ──────────────────────────────────────── */}
      <div className="card mb-6 hidden lg:block">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div className="flex justify-between text-sm" style={{ width: 280 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tRV('subtotal')}</span>
            <span style={{ fontWeight: 500 }}>{formatAmount(subtotal, cc)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ width: 280 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {taxPct > 0
                ? tRV('taxWithPct', { pct: taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1) })
                : tRV('tax')}
            </span>
            <span style={{ fontWeight: 500 }}>{formatAmount(totalTax, cc)}</span>
          </div>
          <div
            style={{
              width: 280,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              marginTop: 2,
            }}
            className="flex justify-between"
          >
            <span style={{ fontWeight: 700 }}>{tRV('total')}</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
              {formatAmount(grandTotal, cc)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 lg:hidden mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tRV('subtotal')}</td>
              <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, cc)}</td>
            </tr>
            <tr>
              <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">
                {taxPct > 0
                  ? tRV('taxWithPct', { pct: taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1) })
                  : tRV('tax')}
              </td>
              <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(totalTax, cc)}</td>
            </tr>
            <tr>
              <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tRV('total')}</td>
              <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{formatAmount(grandTotal, cc)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Consumer-injected content (e.g. returns section) ────── */}
      {children}

      {/* ── Activity timeline (collapsible, closed by default) ──── */}
      {(order.events?.length ?? 0) > 0 && (
        <ActivityTimeline events={order.events!} />
      )}
    </>
  );
}

import ActivityTimeline from './ActivityTimeline';
