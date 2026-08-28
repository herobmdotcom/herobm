'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { compareBinNumbers, getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

interface LocationZoneBin {
  binId: string;
  binNumber: string;
}

interface LocationZone {
  code: string;
  bins?: LocationZoneBin[];
}

interface LocationData {
  code: string;
  zones?: LocationZone[];
}

interface MoveStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lines: { productId: string; sourceBinId: string; targetBinId: string; quantity: string }[], reason: string) => Promise<void>;
  selectedLines: {
    productId: string;
    productName: string;
    sourceBinId: string;
    sourceBinNumber: string;
    quantity: number;
    locationNo: string;
  }[];
}

export default function MoveStockModal({ isOpen, onClose, onSubmit, selectedLines }: MoveStockModalProps) {
  const [reason, setReason] = useState('');
  const [targetBinId, setTargetBinId] = useState('');
  const [bins, setBins] = useState<api.InventoryBinResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tCommon = useTranslations('common');
  // Reusing goodsReceived translation for some strings, or define new ones if needed.
  // Actually we can use hardcoded generic ones for now, or just tCommon
  
  const [editableLines, setEditableLines] = useState(selectedLines);

  useEffect(() => {
    if (isOpen && selectedLines.length > 0) {
      setEditableLines(selectedLines.map(l => ({ ...l })));
      setReason('');
      setLoading(true);
      const locNo = selectedLines[0].locationNo;
      api.inventoryControllerFindAllLocations()
        .then(async (res) => {
          const locs = (res.data || []);
          const loc = locs.find((l) => l.code === locNo);
          if (loc) {
            const binsRes = await api.inventoryControllerFindBinsByLocation(loc.locationId);
            const allBins = binsRes.data || [];
            const availableBins: api.InventoryBinResponseDto[] = [];
            allBins.forEach((b) => {
              // Block moving into system handling bins
              if (b.zoneCode === 'HANDLING') return;
              availableBins.push({ ...b });
            });
            // Sort by bin number using natural alphanumeric comparison
            availableBins.sort((a, b) => compareBinNumbers(a.binNumber, b.binNumber));
            setBins(availableBins);
            if (availableBins.length > 0) {
              setTargetBinId(availableBins[0].binId);
            } else {
              setTargetBinId('');
            }
          }
        })
        .catch((err) => {
          toast.error('Failed to load destination bins: ' + getErrorMessage(err));
          reportError(err, 'MoveStockModal.fetchBins');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBinId) return;

    setSubmitting(true);
    try {
      const payloadLines = editableLines.map(line => ({
        productId: line.productId,
        sourceBinId: line.sourceBinId,
        targetBinId: targetBinId,
        quantity: line.quantity.toString()
      }));

      await onSubmit(payloadLines, reason);
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      reportError(err, 'MoveStockModal');
    } finally {
      setSubmitting(false);
    }
  };

  const footerActions = (
    <div className="flex justify-end gap-3 w-full">
      <Button
        type="button"
        onClick={onClose}
        disabled={submitting}
        variant="secondary"
        className="font-semibold"
      >
        {tCommon('cancel')}
      </Button>
      <Button
        type="submit"
        form="move-stock-form"
        disabled={submitting || loading || (bins.length > 0 && !targetBinId)}
        variant="primary"
        className="font-bold"
      >
        {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
        {submitting ? tCommon('saving') : 'Move'}
      </Button>
    </div>
  );

  const totalQuantity = editableLines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Move Stock"
      subtitle={`Moving ${totalQuantity} items from ${selectedLines.length} bins`}
      width="max-w-3xl"
      footer={footerActions}
    >
      <div className="flex flex-col gap-4 p-4 -mt-4">
        {loading ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">{tCommon('loading')}</div>
        ) : (
          <form id="move-stock-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              { }
              <label className="text-sm font-medium text-[var(--text-muted)]">
                Selected Items
              </label>
              
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider hidden sm:table-header-group">
                    <tr>
                      { }
                      <th className="px-4 py-2">Product</th>
                      { }
                      <th className="px-4 py-2">Source Bin</th>
                      { }
                      <th className="px-4 py-2">Recorded Qty</th>
                      { }
                      <th className="px-4 py-2">Move Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 flex flex-col sm:table-row-group">
                    {editableLines.map((line, idx) => {
                      const originalLine = selectedLines[idx];
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors flex flex-col sm:table-row p-3 sm:p-0">
                          <td className="px-0 sm:px-4 py-1 sm:py-3 text-[#041627]">
                            <span className="font-semibold sm:font-normal">{line.productName}</span>
                          </td>
                          <td className="px-0 sm:px-4 py-1 sm:py-3 text-[#041627] flex items-center justify-between sm:table-cell">
                            { }
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Source:</span>
                            <span>{line.sourceBinNumber}</span>
                          </td>
                          <td className="px-0 sm:px-4 py-1 sm:py-3 text-[#041627] flex items-center justify-between sm:table-cell">
                            { }
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Recorded:</span>
                            <span>{originalLine?.quantity || 0}</span>
                          </td>
                          <td className="px-0 sm:px-4 py-2 sm:py-3 flex items-center justify-between sm:table-cell">
                            { }
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Move Qty:</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min={0.001}
                                max={originalLine?.quantity || line.quantity}
                                step="any"
                                className="input text-sm w-24 text-right" 
                                value={line.quantity} 
                                onChange={e => {
                                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                  const newLines = editableLines.map(l => ({...l}));
                                  newLines[idx].quantity = (val === '' || isNaN(val as number)) ? 0 : val as number;
                                  setEditableLines(newLines);
                                }} 
                                required
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              { }
              <label className="text-sm font-medium text-[var(--text-muted)]">
                Destination Bin
              </label>
              {bins.length > 0 ? (
                <select
                  className="input text-sm"
                  value={targetBinId}
                  onChange={(e) => setTargetBinId(e.target.value)}
                  required
                >
                  {bins.map(b => (
                    <option key={b.binId} value={b.binId}>
                      {b.zoneCode ? `${b.zoneCode}.${b.binNumber}` : b.binNumber}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-[var(--text-secondary)] italic">
                  {tCommon('noBinsFound')}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              { }
              <label className="text-sm font-medium text-[var(--text-muted)]">
                Reason (Optional)
              </label>
              <input
                type="text"
                className="input text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are these items being moved?"
                autoFocus
              />
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
