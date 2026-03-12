'use client';

/**
 * OrderTotalsCard — shared summary card showing Subtotal, Tax, and Total.
 * Used by both the create and edit order screens.
 */
interface OrderTotalsCardProps {
  subtotal: number;
  totalTax: number;
}

export default function OrderTotalsCard({ subtotal, totalTax }: OrderTotalsCardProps) {
  const grandTotal = subtotal + totalTax;
  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;

  return (
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
        <div className="flex justify-between text-sm" style={{ width: 260 }}>
          <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
          <span style={{ fontWeight: 500 }}>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm" style={{ width: 260 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Tax{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
          </span>
          <span style={{ fontWeight: 500 }}>${totalTax.toFixed(2)}</span>
        </div>
        <div
          style={{
            width: 260,
            borderTop: '1px solid var(--border)',
            paddingTop: 8,
            marginTop: 2,
          }}
          className="flex justify-between"
        >
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
            ${grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
