'use client';

import { useTranslations } from 'next-intl';
import { tDynamic } from '../../lib/i18n';
import type { Shipment, OrderLine } from '../../hooks/usePickingData';

import {
  SHIPMENT_TRANSITIONS as SHIPMENT_STATE_TRANSITIONS,
  SHIPMENT_LIFECYCLE,
  isBackTransition,
} from '@modbm/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBackShipmentTransition(from: string, to: string): boolean {
  return isBackTransition(SHIPMENT_LIFECYCLE, from, to);
}

function ShipmentStateBadge({ state }: { state: string }) {
  const t = useTranslations('common.states');
  const colours: Record<string, string> = {
    draft: 'var(--badge-draft, #6b7280)',
    dispatched: 'var(--badge-shipped, #059669)',
    cancelled: 'var(--badge-cancelled, #dc2626)',
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

// ---------------------------------------------------------------------------
// ShipmentCard — Displays a single shipment with state transitions and
//                inline-editable notes/tracking fields
// ---------------------------------------------------------------------------

export default function ShipmentCard({
  shipment,
  orderLines,
  onChangeState,
  onUpdateHeader,
}: {
  shipment: Shipment;
  orderLines: OrderLine[];
  onChangeState: (shipmentId: string, newState: string) => void;
  onUpdateHeader: (shipmentId: string, notes: string | null, tracking: string | null) => void;
}) {
  const tCommon = useTranslations('common');
  const tPicking = useTranslations('picking');

  const allowedTransitions = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode] || [];

  return (
    <div
      style={{
        marginBottom: 12, padding: 12, borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-card, #fff)',
      }}
    >
      {/* Header: shipment number + badge + transition buttons */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <strong style={{ fontSize: 13 }}>{shipment.shipmentNumber}</strong>
          <ShipmentStateBadge state={shipment.stateCode} />
        </div>
        <div className="flex items-center gap-2">
          {[...allowedTransitions]
            .sort((a, b) => {
              const aBack = isBackShipmentTransition(shipment.stateCode, a);
              const bBack = isBackShipmentTransition(shipment.stateCode, b);
              if (aBack !== bBack) return aBack ? -1 : 1;
              return 0;
            })
            .map((state) => {
              const back = isBackShipmentTransition(shipment.stateCode, state);
              return (
                <button
                  type="button"
                  key={state}
                  className={`btn btn-sm ${
                    state === 'cancelled' ? 'btn-danger' : back ? 'btn-secondary' : 'btn-primary'
                  }`}
                  onClick={() => onChangeState(shipment.shipmentId, state)}
                >
                  {state === 'cancelled'
                    ? `✕ ${tDynamic(tCommon, `states.${state}`)}`
                    : back
                      ? `← ${tDynamic(tCommon, `states.${state}`)}`
                      : `→ ${tDynamic(tCommon, `states.${state}`)}`}
                </button>
              );
            })}
        </div>
      </div>

      {/* Inline-editable notes & tracking */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            className="input"
            disabled={shipment.stateCode === 'cancelled'}
            defaultValue={shipment.notes || ''}
            key={`notes-${shipment.shipmentId}-${shipment.notes}`}
            onBlur={(e) => {
              const val = e.target.value || null;
              if (val !== (shipment.notes || null)) {
                onUpdateHeader(shipment.shipmentId, val, shipment.trackingNumber);
              }
            }}
            placeholder={tPicking('placeholders.notes')}
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            className="input"
            disabled={shipment.stateCode === 'cancelled'}
            defaultValue={shipment.trackingNumber || ''}
            key={`tracking-${shipment.shipmentId}-${shipment.trackingNumber}`}
            onBlur={(e) => {
              const val = e.target.value || null;
              if (val !== (shipment.trackingNumber || null)) {
                onUpdateHeader(shipment.shipmentId, shipment.notes, val);
              }
            }}
            placeholder={tPicking('placeholders.tracking')}
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>
      </div>

      {/* Shipment lines table */}
      <table className="table-lines">
        <thead>
          <tr>
            <th>{tPicking('columns.product')}</th>
            <th>{tPicking('columns.description')}</th>
            <th style={{ textAlign: 'right' }}>{tPicking('columns.shipped')}</th>
          </tr>
        </thead>
        <tbody>
          {[...shipment.lines]
            .sort((a, b) => {
              const aIdx = orderLines.findIndex((ol) => ol.salesOrderLineId === a.salesOrderLineId);
              const bIdx = orderLines.findIndex((ol) => ol.salesOrderLineId === b.salesOrderLineId);
              return aIdx - bIdx;
            })
            .map((sl) => {
              const orderLine = orderLines.find(
                (ol) => ol.salesOrderLineId === sl.salesOrderLineId,
              );
              return (
                <tr key={sl.shipmentLineId}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    {orderLine?.productNumber || orderLine?.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{orderLine?.productDescription || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{sl.quantityShipped}</td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {shipment.createdBy
          ? tPicking('createdOnBy', { date: new Date(shipment.createdOn).toLocaleDateString(), user: shipment.createdBy })
          : tPicking('createdOn', { date: new Date(shipment.createdOn).toLocaleDateString() })}
      </div>
    </div>
  );
}
