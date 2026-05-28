'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@modbm/sdk';

export default function InitiateReturnModal({
  isOpen,
  onClose,
  orderId,
  orderLines,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderLines: any[];
  onSuccess: () => void;
}) {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');

  const [returnLines, setReturnLines] = useState<{ [key: string]: string }>({});
  const [returnReasons, setReturnReasons] = useState<{ [key: string]: string }>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validLines = orderLines.filter(line => parseFloat(line.quantityReceived || '0') > 0);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const linesPayload = validLines
        .filter(l => parseFloat(returnLines[l.purchaseOrderLineId] || '0') > 0)
        .map(l => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          quantityReturned: parseFloat(returnLines[l.purchaseOrderLineId]).toString(),
          reason: returnReasons[l.purchaseOrderLineId] || 'Defective',
        }));

      if (linesPayload.length === 0) {
        throw new Error('Please enter a return quantity for at least one item.');
      }

      await api.purchaseReturnsControllerCreateReturn(orderId, {
        notes,
        lines: linesPayload,
      } );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Initiate Return">
      <div className="flex flex-col h-full bg-[var(--bg-card)]">
        <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tPurchase('returns.selectLinesMsg')}
          </p>
        </div>

        <table className="table-lines mb-6">
          <thead>
            <tr>
              <th>{tPurchase('columns.product')}</th>
              <th>{tPurchase('columns.description')}</th>
              <th className="text-right">{tPurchase('columns.received')}</th>
              <th className="text-right">{tPurchase('returns.qtyToReturn')}</th>
              <th>{tPurchase('returns.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {validLines.map(line => {
              const received = parseFloat(line.quantityReceived || '0');
              const returned = parseFloat(line.quantityReturned || '0');
              const maxReturn = Math.max(0, received - returned);

              return (
                <tr key={line.purchaseOrderLineId}>
                  <td className="font-semibold text-xs">
                    {line.productNumber || line.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  <td className="text-right">{tPurchase('returns.maxReturn', { received, maxReturn })}</td>
                  <td className="text-right">
                    <input
                      type="number"
                      className="input text-right w-24"
                      min="0"
                      max={maxReturn}
                      step="any"
                      value={returnLines[line.purchaseOrderLineId] || ''}
                      onChange={e => setReturnLines({ ...returnLines, [line.purchaseOrderLineId]: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="input w-full"
                      value={returnReasons[line.purchaseOrderLineId] || 'Defective'}
                      onChange={e => setReturnReasons({ ...returnReasons, [line.purchaseOrderLineId]: e.target.value })}
                    >
                      <option value="Defective">{tPurchase('returns.reasons.defective')}</option>
                      <option value="Over-shipment">{tPurchase('returns.reasons.overShipment')}</option>
                      <option value="Incorrect Item">{tPurchase('returns.reasons.incorrectItem')}</option>
                      <option value="Other">{tPurchase('returns.reasons.other')}</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {validLines.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  {tPurchase('returns.noReturnableLines')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">{tPurchase('returns.notes')}</label>
          <textarea
            className="input w-full"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional return notes..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {tCommon('cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? tPurchase('returns.creating') : tPurchase('returns.createReturn')}
          </button>
        </div>
        </div>
      </div>
    </SlideOver>
  );
}
