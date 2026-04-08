'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PickingSummaryLine, PickingSummary, OrderLine } from '../../hooks/usePickingData';

// ---------------------------------------------------------------------------
// PickingTable — Pure presentation of pick lines with inline qty editing
// ---------------------------------------------------------------------------

export default function PickingTable({
  summary,
  isPickingState,
  enableShippedFloorCheck,
  onPickLine,
  onPickAllForLine,
  onUpdateLocation,
  locations,
}: {
  summary: PickingSummary;
  isPickingState: boolean;
  enableShippedFloorCheck: boolean;
  onPickLine: (lineId: string, qty: string) => void;
  onPickAllForLine: (lineId: string) => void;
  onUpdateLocation?: (lineId: string, locationId: string) => void;
  locations?: { locationId: string; name: string }[];
}) {
  const tPicking = useTranslations('picking');

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editPickQty, setEditPickQty] = useState('');

  return (
    <table className="table-lines">
      <thead>
        <tr>
          <th style={{ width: 50 }}>{tPicking('columns.lineNumber')}</th>
          <th>{tPicking('columns.product')}</th>
          <th>{tPicking('columns.description')}</th>
          <th style={{ width: 140 }}>{tPicking('columns.location')}</th>
          <th style={{ width: 90, textAlign: 'right' }}>{tPicking('columns.ordered')}</th>
          <th style={{ width: 90, textAlign: 'right' }}>{tPicking('columns.onHand')}</th>
          <th style={{ width: 110, textAlign: 'right' }}>{tPicking('columns.picked')}</th>
          <th style={{ width: 90, textAlign: 'right' }}>{tPicking('columns.shipped')}</th>
          <th style={{ width: 90, textAlign: 'right' }}>{tPicking('columns.remaining')}</th>
          {isPickingState && <th style={{ width: 120, textAlign: 'center' }}>{tPicking('columns.action')}</th>}
        </tr>
      </thead>
      <tbody>
        {[...summary.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => (
          <tr key={line.salesOrderLineId}>
            <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
            <td style={{ fontWeight: 600, fontSize: 12 }}>
              {line.productNumber || line.productId?.substring(0, 8) || '—'}
            </td>
            <td>{line.productDescription || '—'}</td>
            <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isPickingState && parseFloat(line.quantityPicked) === 0 && onUpdateLocation && locations && locations.length > 0 ? (
                <select
                  className="input p-1 h-auto"
                  style={{ fontSize: 13 }}
                  value={locations.find(l => l.name === line.locationName)?.locationId || ''}
                  onChange={(e) => onUpdateLocation(line.salesOrderLineId, e.target.value)}
                >
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span title={isPickingState && parseFloat(line.quantityPicked) > 0 ? tPicking('errors.unpickToChangeLocation' as any) : undefined}>
                  {line.locationName}
                </span>
              )}
            </td>
            <td style={{ textAlign: 'right' }}>{line.quantity}</td>
            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{line.onHand ?? '0'}</td>
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
                      if (e.key === 'Enter') {
                        onPickLine(line.salesOrderLineId, editPickQty);
                        setEditingLineId(null);
                      }
                      if (e.key === 'Escape') setEditingLineId(null);
                    }}
                    autoFocus
                    style={{
                      width: 60, padding: '2px 6px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: 13, textAlign: 'right',
                    }}
                  />
                  <button
                    style={{
                      padding: '2px 6px', borderRadius: 4,
                      background: 'var(--color-primary, #3b82f6)', color: '#fff',
                      border: 'none', fontSize: 11, cursor: 'pointer',
                    }}
                    onClick={() => {
                      onPickLine(line.salesOrderLineId, editPickQty);
                      setEditingLineId(null);
                    }}
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span aria-hidden>✓</span>
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
                  title={isPickingState ? tPicking('clickToEdit') : undefined}
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
                      fontSize: 11, padding: '2px 8px',
                      background: 'var(--color-primary, #3b82f6)', color: '#fff',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}
                    onClick={() => onPickAllForLine(line.salesOrderLineId)}
                  >
                    {tPicking('actions.pickAll')}
                  </button>
                )}
                {line.isFullyPicked && (
                  <span style={{ color: 'var(--color-success, #059669)', fontWeight: 600, fontSize: 12 }}>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span aria-hidden>✓</span>{' '}{tPicking('actions.done')}
                  </span>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
