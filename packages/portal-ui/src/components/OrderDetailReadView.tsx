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

/* ── Type definitions ────────────────────────────────────────────── */

export interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  amount: string;
  tax: string;
  totalAmount: string;
  unitOfMeasure: string;
  gstCategoryId?: string | null;
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
  customerDiscount?: string | null;
  gstCategoryId?: string | null;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  source?: 'abm' | 'app';
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
}

/* ── Helper components ────────────────────────────────────────────── */

export function StateBadge({ state }: { state: string }) {
  return <span className={`badge badge-${state}`}>{state}</span>;
}

export function EventIcon({ type }: { type: string }) {
  const t = (type || '').toLowerCase();

  if (t.includes('shipment')) return <span>🚚</span>;
  if (t.includes('picking')) return <span>📦</span>;
  if (t.includes('return')) return <span>↩️</span>;
  if (t.includes('auto_status')) return <span>⚡</span>;

  const icons: Record<string, string> = {
    created: '📑',
    updated: '✏️',
    status_changed: '🔄',
    line_added: '📦',
    line_updated: '📦',
    line_removed: '📦',
    quoted: '📨',
    confirmed: '✅',
    cancelled: '❌',
  };
  return <span>{icons[t] || '📌'}</span>;
}

/* ── Main component ───────────────────────────────────────────────── */

export default function OrderDetailReadView({
  order,
  formatAmount,
  headerActions,
  children,
}: OrderDetailReadViewProps) {
  const subtotal = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.amount || '0'), 0,
  );
  const totalTax = order.lines.reduce(
    (sum, l) => sum + parseFloat(l.tax || '0'), 0,
  );
  const grandTotal = subtotal + totalTax;
  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
  const cc = order.currencyCode || 'EUR';

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <StateBadge state={order.stateCode} />
            {order.source === 'abm' && (
              <span className="badge badge-abm">ABM</span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {order.name || 'Untitled order'}
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
          Order Details
        </summary>
        <div className="grid grid-cols-2 gap-y-3 text-sm" style={{ marginTop: 16 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>
              Customer
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
              {order.gstCategoryId && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  EXEMPT
                </span>
              )}
              {parseFloat(order.customerDiscount || '0') > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(74,222,128,0.15)',
                    color: '#4ade80',
                    fontWeight: 600,
                    fontSize: 10,
                    letterSpacing: '0.04em',
                  }}
                >
                  {parseFloat(order.customerDiscount!)}% disc
                </span>
              )}
            </span>
            <p style={{ fontWeight: 500 }}>{order.customerId || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Customer PO</span>
            <p style={{ fontWeight: 500 }}>{order.customerOrderNumber || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Order Name</span>
            <p style={{ fontWeight: 500 }}>{order.name || '—'}</p>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Created</span>
            <p style={{ fontWeight: 500 }}>
              {order.createdOn
                ? new Date(order.createdOn).toLocaleString()
                : '—'}
              {order.createdBy ? ` by ${order.createdBy}` : ''}
            </p>
          </div>
          {order.notes && (
            <div className="col-span-2">
              <span style={{ color: 'var(--text-muted)' }}>Notes</span>
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
          Line Items
        </h3>
        <table className="table-lines">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Product</th>
              <th>Description</th>
              <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
              <th style={{ width: 110, textAlign: 'right' }}>Unit Price</th>
              <th style={{ width: 80, textAlign: 'right' }}>Disc %</th>
              <th style={{ width: 110, textAlign: 'right' }}>GST</th>
              <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.salesOrderLineId}>
                <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                <td style={{ fontWeight: 600, fontSize: 12 }}>
                  {line.productId?.substring(0, 8) || '—'}
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
                    if (amt > 0 && tax === 0) return 'Exempt';
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
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Totals summary ──────────────────────────────────────── */}
      <div className="card mb-6">
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
            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
            <span style={{ fontWeight: 500 }}>{formatAmount(subtotal, cc)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ width: 280 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Tax{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
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
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
              {formatAmount(grandTotal, cc)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Consumer-injected content (e.g. returns section) ────── */}
      {children}

      {/* ── Activity timeline (collapsible, closed by default) ──── */}
      {(order.events?.length ?? 0) > 0 && (
        <details className="card">
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
            Activity Timeline
            <span style={{ fontSize: 11, fontWeight: 400 }}>({order.events!.length})</span>
          </summary>
          <div className="space-y-3" style={{ marginTop: 16 }}>
            {[...order.events!].reverse().map((event) => {
              const hasPayload = event.payload && Object.keys(event.payload).length > 0;
              return (
                <details
                  key={event.eventId}
                  className="text-sm"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(30,58,95,0.3)',
                  }}
                >
                  <summary
                    className="flex items-center gap-3"
                    style={{ cursor: hasPayload ? 'pointer' : 'default', userSelect: 'none', listStyle: 'none' }}
                  >
                    <EventIcon type={event.eventType} />
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      by {event.actor}
                    </span>
                    <span className="ml-auto text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.createdOn).toLocaleString()}
                    </span>
                    {hasPayload && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>▶</span>
                    )}
                  </summary>
                  {hasPayload && (
                    <div
                      className="mt-2 text-xs grid gap-y-1"
                      style={{ marginLeft: 28, color: 'var(--text-secondary)' }}
                    >
                      {Object.entries(event.payload).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span style={{ color: 'var(--text-muted)', minWidth: 100, fontWeight: 500 }}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {typeof value === 'object' && value !== null
                              ? Object.entries(value as Record<string, unknown>)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}
