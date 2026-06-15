'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { tDynamic } from '@/lib/i18n';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { PURCHASE_RETURN_STATE } from '@herobm/shared';
import InitiateReturnModal from './InitiateReturnModal';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';

interface ReturnLine {
  returnLineId: string;
  purchaseOrderLineId: string;
  quantityReturned: string;
  productId?: string;
  productDescription?: string;
}

interface ReturnDestination {
  locationName: string;
  zoneName: string;
  binName: string;
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
  destination?: ReturnDestination;
}

function PurchaseReturnStateBadge({ state }: { state: string }) {
  const t = useTranslations('common.states');
  const colours: Record<string, string> = {
    [PURCHASE_RETURN_STATE.SHIPPED]: 'var(--badge-shipped, #059669)',
    [PURCHASE_RETURN_STATE.CANCELLED]: 'var(--badge-cancelled, #dc2626)',
  };
  return (
    <span
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        background: `${colours[state] || '#6b7280'}18`,
        color: colours[state] || '#6b7280',
        border: `1px solid ${colours[state] || '#6b7280'}40`,
      }}
    >
      {tDynamic(t, state)}
    </span>
  );
}

function ReturnCard({
  r,
  orderLines,
  events,
  currencyCode,
  orderId,
}: {
  r: Return;
  orderLines: import("./types").OrderLine[];
  events: import("./types").OrderEvent[];
  currencyCode?: string;
  orderId: string;
}) {
  const tPurchase = useTranslations('purchaseOrders');

  return (
    <div
      style={{
        marginBottom: 12, padding: 12, borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-card, #fff)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <strong style={{ fontSize: 13 }}>{r.returnNumber}</strong>
          <PurchaseReturnStateBadge state={r.stateCode} />
        </div>
        {r.stateCode === PURCHASE_RETURN_STATE.SHIPPED && (
          <a
            href={`/purchase-orders/returns/${r.returnId}`}
            className="btn btn-primary btn-sm"
          >
            {tPurchase('returns.enterDebitNote')}
          </a>
        )}
        {(r.stateCode === PURCHASE_RETURN_STATE.DRAFT || r.stateCode === PURCHASE_RETURN_STATE.STAGED) && (
          <button
            className="btn btn-danger btn-sm"
            onClick={async () => {
              if (!confirm('Are you sure you want to cancel this return?')) return;
              try {
                await api.purchaseReturnsControllerCancelReturn(orderId, r.returnId, {});
                window.location.reload(); // Simple refresh to update state
              } catch (err) {
                reportError(err, 'ReturnsSection.cancelReturn');
                alert(err instanceof Error ? err.message : 'Failed to cancel return');
              }
            }}
          >
            {/* eslint-disable-next-line no-restricted-syntax */}
            {'Cancel Return'}
          </button>
        )}
      </div>

      {(() => {
        const relatedEvents = events?.filter(e => e.payload && e.payload.returnId === r.returnId) || [];
        
        const locWarning = relatedEvents.find(e => e.eventType === 'location_discrepancy_warning');

        return locWarning ? (
          <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, marginBottom: 12, fontSize: 12, color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
             {/* eslint-disable-next-line i18next/no-literal-string */}
             <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
             <strong>{tPurchase('locationWarningPrefix')}</strong> {tPurchase('locationWarning')}
          </div>
        ) : null;
      })()}

      <div style={{ fontSize: 13, gap: 16, marginBottom: 12, display: 'flex', flexWrap: 'wrap' }}>
        {r.destination && (
          <div style={{ flex: '1 1 auto', minWidth: 200 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('location')}: </span>
            {r.destination.locationName} &mdash; {r.destination.zoneName} ({r.destination.binName})
          </div>
        )}
        {r.packingSlipNumber && (
          <div style={{ flex: '1 1 auto', minWidth: 150 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('packingSlip')}: </span>
            {r.packingSlipNumber}
          </div>
        )}
        {r.notes && (
          <div style={{ flex: '1 1 auto', minWidth: 200 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('labels.notes')}: </span>
            {r.notes}
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="table-lines w-full">
          <thead>
            <tr>
              <th>{tPurchase('columns.product')}</th>
              <th>{tPurchase('columns.description')}</th>
              <th style={{ textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
              <th style={{ textAlign: 'right' }}>{tPurchase('columns.qtyReturned')}</th>
            </tr>
          </thead>
          <tbody>
            {[...r.lines]
              .sort((a, b) => {
                const aIdx = orderLines.findIndex((ol) => ol.purchaseOrderLineId === a.purchaseOrderLineId);
                const bIdx = orderLines.findIndex((ol) => ol.purchaseOrderLineId === b.purchaseOrderLineId);
                return aIdx - bIdx;
              })
              .map((rl) => {
                const orderLine = orderLines.find(
                  (ol) => ol.purchaseOrderLineId === rl.purchaseOrderLineId,
                );
                return (
                  <tr key={rl.returnLineId}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                      {orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                    </td>
                    <td>{orderLine?.productDescription || rl.productDescription || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {(() => {
                        const relatedEvents = events?.filter(e => e.payload && e.payload.returnId === r.returnId) || [];
                        const priceWarning = relatedEvents.find(e => e.eventType === 'price_discrepancy_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
                        
                        if (priceWarning) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const payload = priceWarning.payload as any;
                          return (
                            <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} title="Price discrepancy warning">
                              <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: 11, color: 'var(--text-muted)' }}>
                                {parseFloat(payload.poPrice).toFixed(2)}
                              </span>
                              <strong style={{ fontSize: 12 }}>
                                {currencyCode ? `${currencyCode} ` : ''}
                                {parseFloat(payload.invoicePrice).toFixed(2)}
                              </strong>
                            </div>
                          );
                        }
                        const poPrice = orderLine ? parseFloat(orderLine.pricePerUnit).toFixed(2) : '—';
                        if (poPrice === '—') return poPrice;
                        return currencyCode ? `${currencyCode} ${poPrice}` : poPrice;
                      })()}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {(() => {
                        const relatedEvents = events?.filter(e => e.payload && e.payload.returnId === r.returnId) || [];
                        const qtyWarning = relatedEvents.find(e => e.eventType === 'over_returned_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
                        
                        if (qtyWarning) {
                          return (
                            <span style={{ color: '#d97706', fontWeight: 600 }} title="Over-returned warning">
                              {parseFloat(rl.quantityReturned || '0')}*
                            </span>
                          );
                        }
                        return parseFloat(rl.quantityReturned || '0');
                      })()}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="flex flex-col lg:hidden mt-2">
        {[...r.lines]
          .sort((a, b) => {
            const aIdx = orderLines.findIndex((ol) => ol.purchaseOrderLineId === a.purchaseOrderLineId);
            const bIdx = orderLines.findIndex((ol) => ol.purchaseOrderLineId === b.purchaseOrderLineId);
            return aIdx - bIdx;
          })
          .map((rl, idx) => {
            const orderLine = orderLines.find(
              (ol) => ol.purchaseOrderLineId === rl.purchaseOrderLineId,
            );
            
            const relatedEvents = events?.filter(e => e.payload && e.payload.returnId === r.returnId) || [];
            const priceWarning = relatedEvents.find(e => e.eventType === 'price_discrepancy_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
            const qtyWarning = relatedEvents.find(e => e.eventType === 'over_returned_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
            
            return (
              <MobileLineItemCard
                key={rl.returnLineId}
                title={orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                subtitle={orderLine?.productDescription || rl.productDescription || '—'}
                topRightBadge={`#${idx + 1}`}
                details={[
                  {
                    label: tPurchase('columns.qtyReturned'),
                    value: (
                      <span className={qtyWarning ? 'text-[#d97706]' : ''}>
                        {parseFloat(rl.quantityReturned || '0')}{qtyWarning ? '*' : ''}
                      </span>
                    )
                  },
                  {
                    label: tPurchase('columns.unitPrice'),
                    value: priceWarning ? (() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const payload = priceWarning.payload as any;
                      return (
                      <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }} title="Price discrepancy warning">
                        <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: 11, color: 'var(--text-muted)' }}>
                          {parseFloat(payload.poPrice).toFixed(2)}
                        </span>
                        <strong style={{ fontSize: 12 }}>
                          {currencyCode ? `${currencyCode} ` : ''}
                          {parseFloat(payload.invoicePrice).toFixed(2)}
                        </strong>
                      </div>
                      );
                    })() : (
                      <span>
                        {orderLine && orderLine.pricePerUnit !== '—' 
                          ? (currencyCode ? `${currencyCode} ${parseFloat(orderLine.pricePerUnit).toFixed(2)}` : parseFloat(orderLine.pricePerUnit).toFixed(2))
                          : '—'
                        }
                      </span>
                    )
                  }
                ]}
              />
            );
        })}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {r.createdBy
          ? `Created by ${r.createdBy} on ${new Date(r.createdOn).toLocaleString()}`
          : `Created on ${new Date(r.createdOn).toLocaleString()}`}
      </div>
    </div>
  );
}

export default function ReturnsSection({
  orderId,
  orderLines,
  events = [],
  currencyCode,
  orderState,
}: {
  orderId: string;
  orderLines: import("./types").OrderLine[];
  events: import("./types").OrderEvent[];
  currencyCode?: string;
  orderState?: string;
}) {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const tPurchase = useTranslations('purchaseOrders');

  // Load Returns
  useEffect(() => {
    let active = true;
    const fetchReturns = async () => {
      try {
        setLoading(true);
        const listData = await api.purchaseReturnsControllerFindReturns(orderId) ;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchedReturns: any[] = Array.isArray(listData) ? listData : (listData as { data?: any[] })?.data || [];
        
        // Fetch full data including lines for each setup
        const detailedReturns = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetchedReturns.map((rec: any) => 
            api.purchaseReturnsControllerFindReturn(orderId, rec.returnId)
          )
        );

        if (active) {
          setReturns(detailedReturns.map(r => r.data) as Return[]);
        }
      } catch (err) {
        // safely ignore missing if not supported yet, or show empty
        console.warn('Failed to load returns', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchReturns();
    return () => { active = false; };
  }, [orderId]);

  const refreshReturns = () => {
    setLoading(true);
    api.purchaseReturnsControllerFindReturns(orderId).then(async (listData: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedReturns: any[] = (listData as { data?: any[] })?.data || (Array.isArray(listData) ? listData : []);
      const detailedReturns = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetchedReturns.map((rec: any) => 
          api.purchaseReturnsControllerFindReturn(orderId, rec.returnId)
        )
      );
      setReturns(detailedReturns.map(r => r.data) as Return[]);
      setLoading(false);
    });
  };

  if (loading) return null;
  
  const canInitiateReturn = ['partially_received', 'received', 'invoiced'].includes(orderState || '');
  if (returns.length === 0 && !canInitiateReturn) return null;

  return (
    <div className="card !border-none" id="receivings-section">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold flex items-center gap-2"
          style={{
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em', margin: 0
          }}
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>assignment_return</span>
          Returns
          <span style={{ fontSize: 11, fontWeight: 400 }}>({returns.length})</span>
        </h3>
        {canInitiateReturn && (
          <button className="btn btn-secondary btn-sm" onClick={() => setIsInitiateModalOpen(true)}>
            {tPurchase('returns.initiateReturn')}
          </button>
        )}
      </div>
      

      <div style={{ marginTop: 16 }}>
        {returns.map((rec) => (
          <ReturnCard key={rec.returnId} r={rec} orderLines={orderLines || []} events={events} currencyCode={currencyCode} orderId={orderId} />
        ))}
      </div>
      <InitiateReturnModal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        orderId={orderId}
        orderLines={orderLines}
        onSuccess={refreshReturns}
      />
    </div>
  );
}
