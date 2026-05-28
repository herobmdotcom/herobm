'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { tDynamic } from '@/lib/i18n';
import * as api from '@modbm/sdk';
import { GOODS_RECEIVED_STATE } from '@modbm/shared';

interface ReceptionLine {
  receptionLineId: string;
  purchaseOrderLineId: string;
  quantityReceived: string;
  productId?: string;
  productDescription?: string;
}

interface ReceptionDestination {
  locationName: string;
  zoneName: string;
  binName: string;
}

interface Reception {
  receptionId: string;
  receptionNumber: string;
  packingSlipNumber?: string | null;
  notes?: string | null;
  stateCode: string;
  createdOn: string;
  createdBy: string;
  lines: ReceptionLine[];
  destination?: ReceptionDestination;
}

function ReceptionStateBadge({ state }: { state: string }) {
  const t = useTranslations('common.states');
  const colours: Record<string, string> = {
    [GOODS_RECEIVED_STATE.RECEIVED]: 'var(--badge-shipped, #059669)',
    archived: 'var(--badge-draft, #6b7280)',
    [GOODS_RECEIVED_STATE.CANCELLED]: 'var(--badge-cancelled, #dc2626)',
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

function ReceptionCard({
  reception,
  orderLines,
  events,
  currencyCode,
}: {
  reception: Reception;
  orderLines: any[];
  events: any[];
  currencyCode?: string;
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
          <strong style={{ fontSize: 13 }}>{reception.receptionNumber}</strong>
          <ReceptionStateBadge state={reception.stateCode} />
        </div>
      </div>

      {(() => {
        const relatedEvents = events?.filter(e => e.payload && e.payload.receptionId === reception.receptionId) || [];
        
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
        {reception.destination && (
          <div style={{ flex: '1 1 auto', minWidth: 200 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('location')}: </span>
            {reception.destination.locationName} &mdash; {reception.destination.zoneName} ({reception.destination.binName})
          </div>
        )}
        {reception.packingSlipNumber && (
          <div style={{ flex: '1 1 auto', minWidth: 150 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('packingSlip')}: </span>
            {reception.packingSlipNumber}
          </div>
        )}
        {reception.notes && (
          <div style={{ flex: '1 1 auto', minWidth: 200 }}>
            <span style={{ color: 'var(--text-muted)' }}>{tPurchase('labels.notes')}: </span>
            {reception.notes}
          </div>
        )}
      </div>

      <table className="table-lines">
        <thead>
          <tr>
            <th>{tPurchase('columns.product')}</th>
            <th>{tPurchase('columns.description')}</th>
            <th style={{ textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
            <th style={{ textAlign: 'right' }}>{tPurchase('columns.qtyReceived')}</th>
          </tr>
        </thead>
        <tbody>
          {[...reception.lines]
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
                <tr key={rl.receptionLineId}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    {orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{orderLine?.productDescription || rl.productDescription || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const relatedEvents = events?.filter(e => e.payload && e.payload.receptionId === reception.receptionId) || [];
                      const priceWarning = relatedEvents.find(e => e.eventType === 'price_discrepancy_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
                      
                      if (priceWarning) {
                        return (
                          <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} title="Price discrepancy warning">
                            <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: 11, color: 'var(--text-muted)' }}>
                              {parseFloat(priceWarning.payload.poPrice).toFixed(2)}
                            </span>
                            <strong style={{ fontSize: 12 }}>
                              {currencyCode ? `${currencyCode} ` : ''}
                              {parseFloat(priceWarning.payload.invoicePrice).toFixed(2)}
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
                      const relatedEvents = events?.filter(e => e.payload && e.payload.receptionId === reception.receptionId) || [];
                      const qtyWarning = relatedEvents.find(e => e.eventType === 'over_received_warning' && e.payload?.purchaseOrderLineId === rl.purchaseOrderLineId);
                      
                      if (qtyWarning) {
                        return (
                          <span style={{ color: '#d97706', fontWeight: 600 }} title="Over-received warning">
                            {parseFloat(rl.quantityReceived || '0')}*
                          </span>
                        );
                      }
                      return parseFloat(rl.quantityReceived || '0');
                    })()}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        {reception.createdBy
          ? `Created by ${reception.createdBy} on ${new Date(reception.createdOn).toLocaleString()}`
          : `Created on ${new Date(reception.createdOn).toLocaleString()}`}
      </div>
    </div>
  );
}

export default function ReceivingSection({
  orderId,
  orderLines,
  events = [],
  currencyCode,
}: {
  orderId: string;
  orderLines: any[];
  events: any[];
  currencyCode?: string;
}) {
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const tPurchase = useTranslations('purchaseOrders');

  // Load Receptions
  useEffect(() => {
    let active = true;
    const fetchReceptions = async () => {
      try {
        setLoading(true);
        const res = await api.goodsReceivedControllerFindAllLines({ purchaseOrderId: orderId } as any);
        const lines = (res.data as any)?.data || [];
        
        // Extract unique reception IDs
        const grIds = Array.from(new Set<string>((lines as unknown[]).map((l: any) => l.goodsReceivedId)));
        
        // Fetch full data including lines for each setup
        const detailedReceptions = await Promise.all(
          grIds.map((id) => 
            api.goodsReceivedControllerFindOne(id)
          )
        );

        if (active) {
          setReceptions(detailedReceptions.map(r => (r as unknown as { data: Reception }).data || (r as unknown as Reception)));
        }
      } catch (err) {
        // safely ignore missing if not supported yet, or show empty
        console.warn('Failed to load receptions', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchReceptions();
    return () => { active = false; };
  }, [orderId]);

  if (loading) return null;
  if (receptions.length === 0) return null;

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
          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>move_to_inbox</span>
          Receiving
          <span style={{ fontSize: 11, fontWeight: 400 }}>({receptions.length})</span>
        </h3>
      </div>
      
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>{tPurchase('receptionSummary')}</h4>
        <table className="table-lines">
          <thead>
            <tr>
              <th>{tPurchase('columns.product')}</th>
              <th>{tPurchase('columns.description')}</th>
              <th style={{ textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
              <th style={{ textAlign: 'right' }}>{tPurchase('columns.qtyReceived')}</th>
              <th style={{ textAlign: 'right' }}>{tPurchase('columns.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {(orderLines || []).map(line => {
              const ordered = parseFloat(line.quantity || '0');
              const received = parseFloat(line.quantityReceived || '0');
              const remaining = Math.max(0, ordered - received);
              return (
                <tr key={line.purchaseOrderLineId || line.salesOrderLineId}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    {line.productNumber || line.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ordered}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: received >= ordered && ordered > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: received >= ordered && ordered > 0 ? 600 : 400 }}>{received}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: remaining === 0 ? 'var(--text-muted)' : undefined }}>{remaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16 }}>
        {receptions.map((rec) => (
          <ReceptionCard key={rec.receptionId} reception={rec} orderLines={orderLines || []} events={events} currencyCode={currencyCode} />
        ))}
      </div>
    </div>
  );
}
