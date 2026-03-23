'use client';

import { useTranslations } from 'next-intl';
import { formatAmount } from '../../lib/currency';

/**
 * OrderTotalsCard — shared summary card showing Subtotal, Tax, and Total.
 * Used by both the create and edit order screens.
 */
interface OrderTotalsCardProps {
  subtotal: number;
  totalTax: number;
  currencyCode?: string;
  inline?: boolean;
}

export default function OrderTotalsCard({ subtotal, totalTax, currencyCode = 'EUR', inline = false }: OrderTotalsCardProps) {
  const grandTotal = subtotal + totalTax;
  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
  const t = useTranslations('common');

  const content = (
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
        <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
        <span style={{ fontWeight: 500 }}>{formatAmount(subtotal, currencyCode)}</span>
      </div>
      <div className="flex justify-between text-sm" style={{ width: 280 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {t('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
        </span>
        <span style={{ fontWeight: 500 }}>{formatAmount(totalTax, currencyCode)}</span>
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
        <span style={{ fontWeight: 700 }}>{t('total')}</span>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
          {formatAmount(grandTotal, currencyCode)}
        </span>
      </div>
    </div>
  );

  if (inline) {
    return <div style={{ marginTop: 20 }}>{content}</div>;
  }

  return (
    <div className="card mb-6">
      {content}
    </div>
  );
}
