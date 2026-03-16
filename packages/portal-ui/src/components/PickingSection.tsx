'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiMutate, reportError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PickingSummaryLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productDescription: string;
  quantity: string;
  quantityPicked: string;
  quantityShipped: string;
  remaining: string;
  isFullyPicked: boolean;
}

interface PickingSummary {
  totalLines: number;
  fullyPickedLines: number;
  isFullyPicked: boolean;
  lines: PickingSummaryLine[];
}

interface ShipmentLine {
  shipmentLineId: string;
  salesOrderLineId: string;
  quantityShipped: string;
}

interface Shipment {
  shipmentId: string;
  shipmentNumber: string;
  salesOrderId: string;
  stateCode: string;
  notes: string | null;
  trackingNumber: string | null;
  createdBy: string | null;
  createdOn: string;
  modifiedOn: string;
  lines: ShipmentLine[];
}

interface OrderLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId: string;
  productDescription: string;
  quantity: string;
}

const SHIPMENT_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ['dispatched', 'cancelled'],
  dispatched: ['draft', 'cancelled'],
  cancelled: [],
};

const SHIPMENT_LIFECYCLE: Record<string, number> = {
  cancelled: 0, draft: 1, dispatched: 2,
};

function isBackShipmentTransition(from: string, to: string): boolean {
  return (SHIPMENT_LIFECYCLE[to] ?? 99) < (SHIPMENT_LIFECYCLE[from] ?? 99) && to !== 'cancelled';
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function ShipmentStateBadge({ state }: { state: string }) {
  const colours: Record<string, string> = {
    draft: 'var(--badge-draft, #6b7280)',
    dispatched: 'var(--badge-shipped, #059669)',
    cancelled: 'var(--badge-cancelled, #dc2626)',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        background: `${colours[state] || '#6b7280'}18`,
        color: colours[state] || '#6b7280',
        border: `1px solid ${colours[state] || '#6b7280'}40`,
      }}
    >
      {state}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PickingSection Component
// ---------------------------------------------------------------------------

export default function PickingSection({
  orderId,
  orderState,
  orderLines,
  onOrderUpdated,
  enableShippedFloorCheck = true,
}: {
  orderId: string;
  orderState: string;
  orderLines: OrderLine[];
  onOrderUpdated: (autoTransitions?: any[]) => void;
  /** When true (default), prevents reducing picked qty below shipped qty */
  enableShippedFloorCheck?: boolean;
}) {
  const [summary, setSummary] = useState<PickingSummary | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline pick quantity editing
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editPickQty, setEditPickQty] = useState('');

  // Inline shipment header editing
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [editShipmentNotes, setEditShipmentNotes] = useState('');
  const [editShipmentTracking, setEditShipmentTracking] = useState('');

  // Create shipment form
  const [showCreateShipment, setShowCreateShipment] = useState(false);
  const [newShipmentNotes, setNewShipmentNotes] = useState('');
  const [newShipmentTracking, setNewShipmentTracking] = useState('');
  const [newShipmentLines, setNewShipmentLines] = useState<
    Array<{ salesOrderLineId: string; quantityShipped: string }>
  >([]);

  const isPickingState = orderState === 'picking';

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadPickingData = useCallback(async () => {
    try {
      const [summaryData, shipmentsData] = await Promise.all([
        apiFetch<PickingSummary>(`/api/orders/${orderId}/picking`),
        apiFetch<Shipment[]>(`/api/orders/${orderId}/shipments`),
      ]);
      setSummary(summaryData);
      setShipments(shipmentsData);
    } catch (err) {
      setSummary(null);
      setShipments([]);
    } finally {
      setInitialLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadPickingData();
  }, [loadPickingData]);

  // ---------------------------------------------------------------------------
  // Picking actions
  // ---------------------------------------------------------------------------

  const pickLine = async (lineId: string, qty: string) => {
    setError('');
    // Client-side floor check: can't reduce below shipped
    if (enableShippedFloorCheck) {
      const line = summary?.lines.find((l) => l.salesOrderLineId === lineId);
      const shipped = parseFloat(line?.quantityShipped || '0');
      if (parseFloat(qty) < shipped) {
        setError(`Cannot reduce picked to ${qty} — ${shipped} already shipped`);
        return;
      }
    }
    try {
      await apiMutate(`/api/orders/${orderId}/picking/lines/${lineId}`, 'PATCH', {
        quantityPicked: qty,
      });
      setEditingLineId(null);
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pick');
    }
  };

  const pickAllForLine = async (lineId: string) => {
    setError('');
    try {
      await apiMutate(`/api/orders/${orderId}/picking/lines/${lineId}/pick-all`, 'POST');
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick all');
    }
  };

  const pickAllOrder = async () => {
    setError('');
    try {
      await apiMutate(`/api/orders/${orderId}/picking/pick-all`, 'POST');
      await loadPickingData();
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick all');
    }
  };

  // ---------------------------------------------------------------------------
  // Shipment actions
  // ---------------------------------------------------------------------------

  const createShipment = async () => {
    setError('');
    const lines = newShipmentLines.filter(
      (l) => l.quantityShipped && parseFloat(l.quantityShipped) > 0,
    );
    if (lines.length === 0) {
      setError('At least one line with a quantity is required');
      return;
    }
    try {
      await apiMutate(`/api/orders/${orderId}/shipments`, 'POST', {
        notes: newShipmentNotes || undefined,
        trackingNumber: newShipmentTracking || undefined,
        lines,
      });
      setShowCreateShipment(false);
      setNewShipmentNotes('');
      setNewShipmentTracking('');
      setNewShipmentLines([]);
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shipment');
    }
  };

  const changeShipmentState = async (shipmentId: string, newState: string) => {
    setError('');
    try {
      const response = await apiMutate<{ _autoTransitions?: any[] }>(
        `/api/orders/${orderId}/shipments/${shipmentId}/state`,
        'PATCH',
        { stateCode: newState }
      );
      
      await loadPickingData();

      if (response && response._autoTransitions && response._autoTransitions.length > 0) {
        onOrderUpdated(response._autoTransitions);
      } else {
        onOrderUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shipment');
    }
  };

  const saveShipmentHeader = async (shipmentId: string) => {
    setError('');
    try {
      await apiMutate(
        `/api/orders/${orderId}/shipments/${shipmentId}`,
        'PATCH',
        {
          notes: editShipmentNotes || null,
          trackingNumber: editShipmentTracking || null,
        }
      );
      setEditingShipmentId(null);
      await loadPickingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shipment');
    }
  };

  // ---------------------------------------------------------------------------
  // Guard: only show if order is picking or has picking data
  // ---------------------------------------------------------------------------

  const hasPickingData =
    summary && (summary.fullyPickedLines > 0 || summary.lines.some((l) => parseFloat(l.quantityPicked) > 0));
  const hasShipments = shipments.length > 0;

  const shouldShow =
    isPickingState ||
    hasPickingData ||
    hasShipments ||
    ['shipped', 'invoiced', 'legacy'].includes(orderState);

  if (initialLoading) return null;
  if (!shouldShow || !summary) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const progressPct = summary.totalLines > 0
    ? Math.round((summary.fullyPickedLines / summary.totalLines) * 100)
    : 0;

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Picking Progress Card                                              */}
      {/* ------------------------------------------------------------------ */}
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
          📦 Picking Progress
        </summary>

        {isPickingState && (
          <div className="flex items-center gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={pickAllOrder}>
              ✅ Pick All &amp; Create Shipment
            </button>
            {!showCreateShipment && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={!summary || summary.fullyPickedLines === 0 && !summary.lines.some((l) => parseFloat(l.quantityPicked) > 0)}
                onClick={() => {
                  setShowCreateShipment(true);
                  setNewShipmentNotes('');
                  setNewShipmentLines(
                    orderLines.map((l) => {
                      const pickLine = summary?.lines.find(
                        (sl) => sl.salesOrderLineId === l.salesOrderLineId,
                      );
                      const picked = parseFloat(pickLine?.quantityPicked || '0');
                      const shipped = parseFloat(pickLine?.quantityShipped || '0');
                      const available = Math.max(0, picked - shipped);
                      return {
                        salesOrderLineId: l.salesOrderLineId,
                        quantityShipped: available > 0 ? String(available) : '',
                      };
                    }),
                  );
                }}
              >
                🚚 Create Shipment
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: 'var(--surface-raised, #1f2937)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: 4,
                background: summary.isFullyPicked
                  ? 'var(--color-success, #059669)'
                  : 'var(--color-primary, #3b82f6)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {summary.fullyPickedLines} / {summary.totalLines} lines picked
          </span>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 6,
              background: 'rgba(220, 38, 38, 0.1)',
              color: '#ef4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Line items table */}
        <table className="table-lines">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Product</th>
              <th>Description</th>
              <th style={{ width: 90, textAlign: 'right' }}>Ordered</th>
              <th style={{ width: 110, textAlign: 'right' }}>Picked</th>
              <th style={{ width: 90, textAlign: 'right' }}>Shipped</th>
              <th style={{ width: 90, textAlign: 'right' }}>Remaining</th>
              {isPickingState && <th style={{ width: 120, textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {[...summary.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => {
              return (
                <tr key={line.salesOrderLineId}>
                  <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    {line.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isPickingState && editingLineId === line.salesOrderLineId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <input
                          type="number"
                          min={enableShippedFloorCheck ? line.quantityShipped : '0'}
                          max={line.quantity}
                          value={editPickQty}
                          onChange={(e) => setEditPickQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') pickLine(line.salesOrderLineId, editPickQty);
                            if (e.key === 'Escape') setEditingLineId(null);
                          }}
                          autoFocus
                          style={{
                            width: 60,
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: 13,
                            textAlign: 'right',
                          }}
                        />
                        <button
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--color-primary, #3b82f6)',
                            color: '#fff',
                            border: 'none',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          onClick={() => pickLine(line.salesOrderLineId, editPickQty)}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          cursor: isPickingState ? 'pointer' : undefined,
                          textDecoration: isPickingState ? 'underline dotted' : undefined,
                          fontWeight: line.isFullyPicked ? 600 : undefined,
                          color: line.isFullyPicked ? 'var(--color-success, #059669)' : undefined,
                        }}
                        onClick={() => {
                          if (!isPickingState) return;
                          setEditingLineId(line.salesOrderLineId);
                          setEditPickQty(line.quantityPicked);
                        }}
                        title={isPickingState ? 'Click to edit' : undefined}
                      >
                        {line.quantityPicked}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                    {line.quantityShipped}
                  </td>
                  <td style={{ textAlign: 'right', color: line.isFullyPicked ? 'var(--text-muted)' : undefined }}>
                    {line.remaining}
                  </td>
                  {isPickingState && (
                    <td style={{ textAlign: 'center' }}>
                      {!line.isFullyPicked && (
                        <button
                          className="btn btn-sm"
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            background: 'var(--color-primary, #3b82f6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          onClick={() => pickAllForLine(line.salesOrderLineId)}
                        >
                          Pick All
                        </button>
                      )}
                      {line.isFullyPicked && (
                        <span style={{ color: 'var(--color-success, #059669)', fontWeight: 600, fontSize: 12 }}>
                          ✓ Done
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      {/* Create shipment form — inside the picking card area */}
      {showCreateShipment && (
        <div
          className="card mb-6"
          style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <strong style={{ fontSize: 13 }}>🚚 New Shipment</strong>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 16,
              }}
              onClick={() => setShowCreateShipment(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Notes
            </label>
            <input
              type="text"
              className="input"
              value={newShipmentNotes}
              onChange={(e) => setNewShipmentNotes(e.target.value)}
              placeholder="e.g. First batch delivery"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Tracking Number
            </label>
            <input
              type="text"
              className="input"
              value={newShipmentTracking}
              onChange={(e) => setNewShipmentTracking(e.target.value)}
              placeholder="e.g. AU123456789"
              style={{ width: '100%' }}
            />
          </div>

          <table className="table-lines" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Ordered</th>
                <th style={{ textAlign: 'right' }}>Picked</th>
                <th style={{ width: 110, textAlign: 'right' }}>Qty to Ship</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((ol, idx) => {
                const pickLine = summary?.lines.find(
                  (sl) => sl.salesOrderLineId === ol.salesOrderLineId,
                );
                return (
                  <tr key={ol.salesOrderLineId}>
                    <td style={{ color: 'var(--text-muted)' }}>{ol.lineNumber}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{ol.productId?.substring(0, 8) || '—'}</td>
                    <td>{ol.productDescription || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{ol.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{pickLine?.quantityPicked || '0'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        max={ol.quantity}
                        value={newShipmentLines[idx]?.quantityShipped ?? ''}
                        onChange={(e) => {
                          const updated = [...newShipmentLines];
                          updated[idx] = {
                            ...updated[idx],
                            quantityShipped: e.target.value,
                          };
                          setNewShipmentLines(updated);
                        }}
                        placeholder="0"
                        style={{
                          width: 70,
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 13,
                          textAlign: 'right',
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={createShipment}>
              Create Shipment
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCreateShipment(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Existing Shipments                                                 */}
      {/* ------------------------------------------------------------------ */}
      {hasShipments && (
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
            🚚 Shipments
            <span style={{ fontSize: 11, fontWeight: 400 }}>({shipments.length})</span>
          </summary>

          <div style={{ marginTop: 16 }}>
            {shipments.map((shipment) => {
              const allowedTransitions = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode] || [];
              return (
                <div
                  key={shipment.shipmentId}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-raised, #111827)',
                  }}
                >
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
                              onClick={() => changeShipmentState(shipment.shipmentId, state)}
                            >
                                                          {state === 'cancelled' ? `✕ ${cap(state)}` : back ? `← ${cap(state)}` : `→ ${cap(state)}`}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="input"
                        disabled={shipment.stateCode === 'cancelled'}
                        defaultValue={shipment.notes || ''}
                        key={`notes-${shipment.shipmentId}-${shipment.notes}`}
                        onBlur={async (e) => {
                          const val = e.target.value || null;
                          if (val !== (shipment.notes || null)) {
                            try {
                              await apiMutate(
                                `/api/orders/${orderId}/shipments/${shipment.shipmentId}`,
                                'PATCH',
                                { notes: val, trackingNumber: shipment.trackingNumber }
                              );
                              await loadPickingData();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to update shipment');
                            }
                          }
                        }}
                        placeholder="Shipment notes"
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
                        onBlur={async (e) => {
                          const val = e.target.value || null;
                          if (val !== (shipment.trackingNumber || null)) {
                            try {
                              await apiMutate(
                                `/api/orders/${orderId}/shipments/${shipment.shipmentId}`,
                                'PATCH',
                                { notes: shipment.notes, trackingNumber: val }
                              );
                              await loadPickingData();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to update shipment');
                            }
                          }
                        }}
                        placeholder="Tracking #"
                        style={{ width: '100%', fontSize: 12 }}
                      />
                    </div>
                  </div>

                  <table className="table-lines">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Qty Shipped</th>
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
                            <td style={{ fontWeight: 600, fontSize: 12 }}>{orderLine?.productId?.substring(0, 8) || '—'}</td>
                            <td>{orderLine?.productDescription || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{sl.quantityShipped}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Created {new Date(shipment.createdOn).toLocaleDateString()}
                    {shipment.createdBy && ` by ${shipment.createdBy}`}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}
