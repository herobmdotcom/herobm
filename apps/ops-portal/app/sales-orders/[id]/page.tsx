'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import OrderDetailReadView from '@modbm/portal-ui/src/components/OrderDetailReadView';
import type { OrderDetailData } from '@modbm/portal-ui/src/components/OrderDetailReadView';
import { apiFetch } from '@/lib/api';
import { formatAmount } from '@/lib/currency';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get('source') || 'app';

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch<OrderDetailData>(
      `/api/sales-orders/${encodeURIComponent(id)}?source=${source}`,
    )
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [id, source]);

  const handleBack = useCallback(() => router.push('/sales-orders'), [router]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>Loading order…</p>
        </div>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger, #f87171)' }}>
            {error || 'Order not found'}
          </p>
          <button
            className="btn btn-secondary"
            onClick={handleBack}
          >
            ← Back to Orders
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="scroll-area" style={{ flex: 1 }}>
        <OrderDetailReadView
          order={order}
          formatAmount={formatAmount}
          headerActions={
            <button className="btn btn-secondary btn-sm" onClick={handleBack}>
              ← Back
            </button>
          }
        />
      </div>
    </Shell>
  );
}
