'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import InitiateReturnModal from './InitiateReturnModal';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';

interface ReturnLine {
  returnLineId: string;
  purchaseOrderLineId: string;
  quantityReturned: string;
  productId?: string;
  productDescription?: string;
}

interface Return {
  returnId: string;
  returnNumber: string;
  packingSlipNumber?: string | null;
  notes?: string | null;
  stateCode: string;
  createdOn: string;
  createdBy: string;
  lines: ReturnLine[];
}

interface ReturnsSectionProps {
  orderId: string;
  orderState?: string;
  orderLines?: import('./types').OrderLine[];
  events?: import('./types').OrderEvent[];
  currencyCode?: string;
}

export default function ReturnsSection({
  orderId,
  orderState,
  orderLines = [],
  events = [],
}: ReturnsSectionProps) {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);

  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const listData = await api.purchaseReturnsControllerFindReturns(orderId);
      const fetchedReturns = ((listData as { data?: unknown[] })?.data ||
        (Array.isArray(listData) ? listData : [])) as { returnId: string }[];
      const detailedReturns = await Promise.all(
        fetchedReturns.map((rec) =>
          api.purchaseReturnsControllerFindReturn(orderId, rec.returnId),
        ),
      );
      setReturns(detailedReturns.map((r) => r.data) as Return[]);
    } catch (err) {
      console.warn('Failed to load returns', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [orderId]);

  const refreshReturns = () => {
    api.purchaseReturnsControllerFindReturns(orderId).then(async (listData: unknown) => {
      const fetchedReturns = ((listData as { data?: unknown[] })?.data ||
        (Array.isArray(listData) ? listData : [])) as { returnId: string }[];
      const detailedReturns = await Promise.all(
        fetchedReturns.map((rec) =>
          api.purchaseReturnsControllerFindReturn(orderId, rec.returnId),
        ),
      );
      setReturns(detailedReturns.map((r) => r.data) as Return[]);
    });
  };

  const handleCancelReturn = async (e: React.MouseEvent, returnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to cancel this return?')) return;
    try {
      await api.purchaseReturnsControllerCancelReturn(orderId, returnId, {});
      refreshReturns();
    } catch (err) {
      reportError(err, 'ReturnsSection.cancelReturn');
      alert(err instanceof Error ? err.message : 'Failed to cancel return');
    }
  };

  if (loading) return null;

  const canInitiateReturn = ['partially_received', 'received', 'invoiced'].includes(
    orderState || '',
  );
  if (returns.length === 0 && !canInitiateReturn) return null;

  const headingText = tPurchase.has('returnsHeading') ? tPurchase('returnsHeading') : 'Returns';
  const initiateBtnText = tPurchase.has('returns.initiateReturn') ? tPurchase('returns.initiateReturn') : 'Initiate Return';

  return (
    <div id="returns-section" className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">assignment_return</span>
          {headingText} ({returns.length})
        </h3>
        {canInitiateReturn && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsInitiateModalOpen(true)}
          >
            {initiateBtnText}
          </Button>
        )}
      </div>

      {returns.length === 0 ? (
        <div
          className="text-center py-6 text-sm text-[var(--text-muted)]"
        >
          No returns recorded.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {returns.map((ret) => {
            const relatedEvents = events?.filter((e) => e.payload && e.payload.returnId === ret.returnId) || [];
            const locWarning = relatedEvents.find((e) => e.eventType === 'location_discrepancy_warning');

            return (
              <div
                key={ret.returnId}
                className="p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/purchase-orders/returns/${ret.returnId}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <span className="material-symbols-outlined text-[var(--text-muted)] text-lg">
                      assignment_return
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[var(--text-primary)]">
                        {ret.returnNumber}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {formatLocalDate(ret.createdOn)} {' \u00B7 '}{' '}
                        {ret.lines?.length || 0}
                        <span> {tCommon('tabs.lines').toLowerCase()} </span>
                        {ret.createdBy && <span> {' \u00B7 '} {tCommon('timeline.by', { actor: ret.createdBy })}</span>}
                        {ret.packingSlipNumber && <span> {' \u00B7 '} Slip: {ret.packingSlipNumber}</span>}
                        {ret.notes && <span> {' \u00B7 '} Notes: {ret.notes}</span>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <StateBadge state={ret.stateCode as ValidState} />
                  </div>
                </div>

                {locWarning && (
                  <div className="mt-2 text-xs px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">warning_amber</span>
                    <span>
                      <strong>Warning:</strong> Location discrepancy detected for this return.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <InitiateReturnModal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        orderId={orderId}
        orderLines={orderLines}
        existingReturns={returns}
        onSuccess={refreshReturns}
      />
    </div>
  );
}
