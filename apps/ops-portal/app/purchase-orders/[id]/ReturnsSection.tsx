'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import InitiateReturnModal from './InitiateReturnModal';
import { Button } from '@/components/shared/Button';
import { formatLocalDate } from '@/lib/date';
import StateBadge from '@/components/StateBadge';
import LinkedEntityCard from '@/components/shared/LinkedEntityCard';
import { routes } from '@/lib/routes';
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
      reportError(err, 'ReturnsSection.fetchReturns');
      toast.error('Failed to load returns: ' + getErrorMessage(err));
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

            const subtitleTokens = [
              formatLocalDate(ret.createdOn),
              `${ret.lines?.length || 0} ${tCommon('tabs.lines').toLowerCase()}`,
              ret.createdBy ? tCommon('timeline.by', { actor: ret.createdBy }) : null,
              ret.packingSlipNumber ? `Slip: ${ret.packingSlipNumber}` : null,
              ret.notes ? `Notes: ${ret.notes}` : null,
            ];

            return (
              <LinkedEntityCard
                key={ret.returnId}
                icon="assignment_return"
                title={ret.returnNumber}
                href={routes.purchaseOrders.returns.detail(ret.returnId)}
                subtitle={subtitleTokens}
                status={ret.stateCode}
              >
                {locWarning && (
                  <div className="text-xs px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">warning_amber</span>
                    <span>
                      <strong>Warning:</strong> Location discrepancy detected for this return.
                    </span>
                  </div>
                )}
              </LinkedEntityCard>
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
