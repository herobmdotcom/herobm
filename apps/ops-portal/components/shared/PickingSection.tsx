'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePickingData } from '../../hooks/usePickingData';
import type { OrderLine } from '../../hooks/usePickingData';
import PickingTable from './PickingTable';
import ShipmentCard from './ShipmentCard';
import { apiFetch, apiMutate, reportError } from '@/lib/api';

interface Location {
  locationId: string;
  name: string;
}

// ---------------------------------------------------------------------------
// PickingSection — Orchestrator
// ---------------------------------------------------------------------------
// Composes usePickingData, PickingTable, and ShipmentCard.
// Owns only the create-shipment form state and the top-level layout.
// ---------------------------------------------------------------------------

export default function PickingSection({
  orderId,
  orderState,
  orderLines,
  onOrderUpdated,
  enableShippedFloorCheck = true,
  onVisibilityChange,
  locations,
}: {
  orderId: string;
  orderState: string;
  orderLines: OrderLine[];
  onOrderUpdated: (autoTransitions?: unknown[]) => void;
  /** When true (default), prevents reducing picked qty below shipped qty */
  enableShippedFloorCheck?: boolean;
  /** Called whenever the section's internal visibility changes */
  onVisibilityChange?: (visibility: { picking: boolean; shipments: boolean }) => void;
  /** Active Location for Fulfillment */
  fulfillmentLocationId?: string;
  locations?: Location[];
}) {
  const tCommon = useTranslations('common');
  const tPicking = useTranslations('picking');

  const {
    summary: rawSummary,
    shipments,
    initialLoading,
    error,
    loadPickingData,
    pickLine,
    updateLineLocation,
    pickAllForLine,
    pickAllOrder,
    printPickingSlip,
    createShipment,
    changeShipmentState,
    updateShipmentHeader,
  } = usePickingData(orderId, enableShippedFloorCheck, onOrderUpdated, tPicking);

  const summary = rawSummary ? {
    ...rawSummary,
    lines: rawSummary.lines.filter((l) => l.isPhysical !== false),
    totalLines: rawSummary.lines.filter((l) => l.isPhysical !== false).length,
    fullyPickedLines: rawSummary.lines.filter((l) => l.isPhysical !== false && l.isFullyPicked).length,
    isFullyPicked: rawSummary.lines.filter((l) => l.isPhysical !== false).every((l) => l.isFullyPicked),
  } : null;

  // Load on mount
  useEffect(() => { loadPickingData(); }, [loadPickingData]);
  // Re-fetch when order state changes (e.g. transition to picking)
  const prevState = useRef(orderState);
  useEffect(() => {
    if (prevState.current !== orderState) {
      prevState.current = orderState;
      loadPickingData();
    }
  }, [orderState, loadPickingData]);


  // Create-shipment form state
  const [showCreateShipment, setShowCreateShipment] = useState(false);
  const [newShipmentNotes, setNewShipmentNotes] = useState('');
  const [newShipmentTracking, setNewShipmentTracking] = useState('');
  const [newShipmentLines, setNewShipmentLines] = useState<
    Array<{ salesOrderLineId: string; quantityShipped: string }>
  >([]);

  const isPickingState = orderState === 'picking';
  const shipmentsRef = useRef<HTMLDivElement>(null);

  // Guard: only show if relevant
  const hasPickingData =
    summary && (summary.fullyPickedLines > 0 || summary.lines.some((l) => parseFloat(l.quantityPicked) > 0));
  const hasShipments = shipments.length > 0;
  const shouldShow =
    isPickingState || hasPickingData || hasShipments ||
    ['shipped', 'invoiced', 'legacy'].includes(orderState);

  // Notify parent of visibility changes
  const prevVisJson = useRef('');
  useEffect(() => {
    const vis = {
      picking: !initialLoading && shouldShow && !!summary,
      shipments: !initialLoading && shouldShow && !!summary && (hasShipments || isPickingState),
    };
    const json = JSON.stringify(vis);
    if (json !== prevVisJson.current) {
      prevVisJson.current = json;
      onVisibilityChange?.(vis);
    }
  }, [initialLoading, shouldShow, summary, hasShipments, isPickingState, onVisibilityChange]);

  if (initialLoading) return null;
  if (!shouldShow || !summary) return null;

  const progressPct = summary.totalLines > 0
    ? Math.round((summary.fullyPickedLines / summary.totalLines) * 100)
    : 0;


  const openCreateShipmentForm = () => {
    setShowCreateShipment(true);
    setNewShipmentNotes('');
    setNewShipmentTracking('');
    setNewShipmentLines(
      (summary?.lines || []).map((pl) => {
        const picked = parseFloat(pl.quantityPicked || '0');
        const shipped = parseFloat(pl.quantityShipped || '0');
        const available = Math.max(0, picked - shipped);
        return {
          salesOrderLineId: pl.salesOrderLineId,
          quantityShipped: available > 0 ? String(available) : '',
        };
      }),
    );
    setTimeout(() => {
      shipmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCreateShipment = async () => {
    const success = await createShipment(newShipmentLines, newShipmentNotes, newShipmentTracking);
    if (success) {
      setShowCreateShipment(false);
      setNewShipmentNotes('');
      setNewShipmentTracking('');
      setNewShipmentLines([]);
    }
  };

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Picking Progress Card                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="card !border-none">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-sm font-semibold flex items-center gap-2"
            style={{
              color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.05em', margin: 0
            }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>fact_check</span>
            {tPicking('title')}
          </h3>

          <div className="flex items-center gap-4">

          {isPickingState && (
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary btn-sm" onClick={printPickingSlip}>
                {tPicking('printPickingSlip')}
              </button>
              <button
                className="btn btn-secondary btn-sm"
              onClick={async () => {
                await pickAllOrder();
                setTimeout(() => {
                  shipmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
              }}
                disabled={summary.isFullyPicked && summary.lines.every(
                  (l) => parseFloat(l.quantityShipped) >= parseFloat(l.quantity),
                )}
              >
                {tPicking('pickAllCreateShipment')}
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPct}%`, height: '100%', borderRadius: 4,
                background: summary.isFullyPicked ? 'var(--color-success, #059669)' : 'var(--color-primary, #3b82f6)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {tPicking('linesPicked', { picked: String(summary.fullyPickedLines), total: String(summary.totalLines) })}
          </span>
        </div>


        <PickingTable
          summary={summary}
          isPickingState={isPickingState}
          enableShippedFloorCheck={enableShippedFloorCheck}
          onPickLine={pickLine}
          onPickAllForLine={pickAllForLine}
          onUpdateLocation={updateLineLocation}
          locations={locations || []}
        />
      </div>



      {/* ------------------------------------------------------------------ */}
      {/* Existing Shipments                                                 */}
      {/* ------------------------------------------------------------------ */}
      {(hasShipments || isPickingState) && (
        <div ref={shipmentsRef} id="shipments-section" className="card !border-none">
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-semibold flex items-center gap-2"
              style={{
                color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.05em', margin: 0
              }}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)' }}>local_shipping</span>
              {tPicking('shipments')}
              {hasShipments && <span style={{ fontSize: 11, fontWeight: 400 }}>({shipments.length})</span>}
            </h3>
            
            {isPickingState && !showCreateShipment && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!summary || (summary.fullyPickedLines === 0 && !summary.lines.some((l) => parseFloat(l.quantityPicked) > 0))}
                onClick={openCreateShipmentForm}
              >
                {tPicking('createShipment')}
              </button>
            )}
          </div>

          <div style={{ marginTop: 16 }}>

            {/* ------------------------------------------------------------------ */}
            {/* Create Shipment Form                                               */}
            {/* ------------------------------------------------------------------ */}
            {showCreateShipment && (
              <div
                className="card"
                style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: shipments.length > 0 ? 16 : 0 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                    {tPicking('newShipment')}
                  </strong>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
                    onClick={() => setShowCreateShipment(false)}
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span aria-hidden>✕</span>
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {tPicking('columns.notes')}
                  </label>
                  <input
                    type="text" className="input" style={{ width: '100%' }}
                    value={newShipmentNotes}
                    onChange={(e) => setNewShipmentNotes(e.target.value)}
                    placeholder={tPicking('placeholders.notes')}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {tPicking('columns.trackingNumber')}
                  </label>
                  <input
                    type="text" className="input" style={{ width: '100%' }}
                    value={newShipmentTracking}
                    onChange={(e) => setNewShipmentTracking(e.target.value)}
                    placeholder={tPicking('placeholders.tracking')}
                  />
                </div>

                <table className="table-lines" style={{ marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th>{tPicking('columns.lineNumber')}</th>
                      <th>{tPicking('columns.product')}</th>
                      <th>{tPicking('columns.description')}</th>
                      <th style={{ textAlign: 'right' }}>{tPicking('columns.ordered')}</th>
                      <th style={{ textAlign: 'right' }}>{tPicking('columns.picked')}</th>
                      <th style={{ width: 110, textAlign: 'right' }}>{tPicking('columns.qtyToShip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.lines || []).map((pl, idx) => {
                      const ol = orderLines.find((x) => x.salesOrderLineId === pl.salesOrderLineId) || pl as any;
                      return (
                        <tr key={pl.salesOrderLineId}>
                          <td style={{ color: 'var(--text-muted)' }}>{ol.lineNumber}</td>
                          <td style={{ fontWeight: 600, fontSize: 12 }}>
                            {ol.productNumber || ol.productId?.substring(0, 8) || '—'}
                          </td>
                          <td>{ol.productDescription || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{ol.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{pl?.quantityPicked || '0'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number" min="0" max={ol.quantity}
                              value={newShipmentLines[idx]?.quantityShipped ?? ''}
                              onChange={(e) => {
                                const updated = [...newShipmentLines];
                                updated[idx] = { ...updated[idx], quantityShipped: e.target.value };
                                setNewShipmentLines(updated);
                              }}
                              placeholder="0"
                              style={{
                                width: 70, padding: '2px 6px', borderRadius: 4,
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text)', fontSize: 13, textAlign: 'right',
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateShipment}>
                    {tPicking('createShipment')}
                  </button>
                  <button
                    type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setShowCreateShipment(false)}
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              </div>
            )}

            {!hasShipments && !showCreateShipment && (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                {tPicking('noShipmentsYet')}
              </div>
            )}

            {shipments.map((shipment) => (
              <ShipmentCard
                key={shipment.shipmentId}
                shipment={shipment}
                orderLines={orderLines}
                onChangeState={changeShipmentState}
                onUpdateHeader={updateShipmentHeader}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
