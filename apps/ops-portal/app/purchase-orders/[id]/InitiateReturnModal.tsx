'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { getErrorMessage, BIN_TYPE } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface ExistingReturnLine {
  purchaseOrderLineId: string;
  quantityReturned: string;
}

interface ExistingReturn {
  returnId: string;
  stateCode: string;
  lines: ExistingReturnLine[];
}

interface BinItem {
  binId: string;
  binNumber: string;
  binType?: string | null;
  locationId?: string | null;
}

export default function InitiateReturnModal({
  isOpen,
  onClose,
  orderId,
  orderLines,
  existingReturns = [],
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  orderLines: any[];
  existingReturns?: ExistingReturn[];
  onSuccess: () => void;
}) {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');

  const [returnLines, setReturnLines] = useState<{ [key: string]: string }>({});
  const [returnReasons, setReturnReasons] = useState<{ [key: string]: string }>({});
  const [sourceBins, setSourceBins] = useState<{ [key: string]: string }>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableBins, setAvailableBins] = useState<BinItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      api.inventoryControllerFindBins()
        .then((res) => {
          const raw = res.data as unknown;
          const binList = Array.isArray(raw)
            ? raw
            : (raw as { data?: BinItem[] })?.data || [];
          setAvailableBins(binList as BinItem[]);
        })
        .catch((err: unknown) => {
          toast.error(getErrorMessage(err) || 'Failed to load bins');
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getAlreadyReturned = (poLineId: string): number => {
    if (!existingReturns || !Array.isArray(existingReturns)) return 0;
    return existingReturns
      .filter(r => r.stateCode?.toLowerCase() !== 'cancelled')
      .flatMap(r => r.lines || [])
      .filter(l => l.purchaseOrderLineId === poLineId)
      .reduce((sum, l) => sum + parseFloat(l.quantityReturned || '0'), 0);
  };

  const validLines = orderLines.filter(line => {
    const received = parseFloat(line.quantityReceived || '0');
    const alreadyReturned = getAlreadyReturned(line.purchaseOrderLineId);
    return (received - alreadyReturned) > 0;
  });

  // Pre-sort bins: Quarantine first, then regular stock bins
  const sortedBins = [...availableBins].sort((a, b) => {
    const aQuarantine = a.binType === BIN_TYPE.QUARANTINE;
    const bQuarantine = b.binType === BIN_TYPE.QUARANTINE;
    if (aQuarantine && !bQuarantine) return -1;
    if (!aQuarantine && bQuarantine) return 1;
    return (a.binNumber || '').localeCompare(b.binNumber || '');
  }).filter(b => b.binNumber !== 'SUPPLIER_RETURNS');

  // Auto-default source bin for line if not selected
  const getDefaultBinId = () => {
    if (sortedBins.length === 0) return '';
    return sortedBins[0].binId;
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const linesPayload = validLines
        .filter(l => parseFloat(returnLines[l.purchaseOrderLineId] || '0') > 0)
        .map(l => {
          const selectedBinId = sourceBins[l.purchaseOrderLineId] || getDefaultBinId();
          if (!selectedBinId) {
            throw new Error(`Please select a source bin for line ${l.productNumber || l.productId}.`);
          }
          return {
            purchaseOrderLineId: l.purchaseOrderLineId,
            quantityReturned: parseFloat(returnLines[l.purchaseOrderLineId]).toString(),
            reason: returnReasons[l.purchaseOrderLineId] || 'Defective',
            sourceBinId: selectedBinId,
          };
        });

      if (linesPayload.length === 0) {
        throw new Error('Please enter a return quantity for at least one item.');
      }

      await api.purchaseReturnsControllerCreateReturn(orderId, {
        notes,
        lines: linesPayload,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to initiate return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Initiate Return" width="max-w-3xl">
      <div className="flex flex-col h-full bg-[var(--bg-card)]">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <p className="text-sm text-[var(--text-muted)]">
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
                <th>Source Bin</th>
                <th>{tPurchase('returns.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {validLines.map(line => {
                const received = parseFloat(line.quantityReceived || '0');
                const alreadyReturned = getAlreadyReturned(line.purchaseOrderLineId);
                const maxReturn = Math.max(0, received - alreadyReturned);
                const currentBinId = sourceBins[line.purchaseOrderLineId] || getDefaultBinId();

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
                        className="input w-full text-xs"
                        value={currentBinId}
                        onChange={e => setSourceBins({ ...sourceBins, [line.purchaseOrderLineId]: e.target.value })}
                      >
                        <option value="">{tCommon('select')}</option>
                        {sortedBins.map(b => {
                          const isQuarantine = b.binType === BIN_TYPE.QUARANTINE;
                          const binLabel = isQuarantine ? `${b.binNumber} [Quarantine]` : b.binNumber;
                          return (
                            <option key={b.binId} value={b.binId}>
                              {binLabel}
                            </option>
                          );
                        })}
                      </select>
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
                  <td colSpan={6} className="text-center py-4 text-[var(--text-muted)]">
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
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {tCommon('cancel')}
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? tPurchase('returns.creating') : tPurchase('returns.createReturn')}
            </Button>
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
