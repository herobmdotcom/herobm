'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lines: { productId: string; sourceBinId: string; quantity: string }[], reason: string) => Promise<void>;
  selectedLines: {
    productId: string;
    productName: string;
    sourceBinId: string;
    sourceBinNumber: string;
    quantity: number;
    locationNo: string;
  }[];
}

export default function AdjustStockModal({ isOpen, onClose, onSubmit, selectedLines }: AdjustStockModalProps) {
  const [reason, setReason] = useState('');
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
    }
  }, [isOpen, selectedLines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const payloadLines = editableLines.map(line => ({
        productId: line.productId,
        sourceBinId: line.sourceBinId,
        quantity: line.quantity.toString()
      }));

      await onSubmit(payloadLines, reason);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const footerActions = (
    <div className="flex justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="btn btn-secondary font-semibold"
      >
        {tCommon('cancel')}
      </button>
      <button
        type="submit"
        form="adjust-stock-form"
        disabled={submitting}
        className="btn btn-primary font-bold"
      >
        {submitting ? tCommon('saving') : tCommon('adjustStock')}
      </button>
    </div>
  );

  const totalQuantity = editableLines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Stock"
      subtitle={`Adjusting counts for ${selectedLines.length} items`}
      width="max-w-3xl"
      footer={footerActions}
    >
      <div className="flex flex-col gap-4 p-4 -mt-4">
        {loading ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">{tCommon('loading')}</div>
        ) : (
          <form id="adjust-stock-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Selected Items
              </label>
              
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8f9fa] border-b border-gray-200 text-[#041627] font-semibold text-xs uppercase tracking-wider hidden sm:table-header-group">
                    <tr>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="px-4 py-2">Product</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="px-4 py-2">Bin</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="px-4 py-2">Recorded Qty</th>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <th className="px-4 py-2">Actual Qty</th>
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
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Source:</span>
                            <span>{line.sourceBinNumber}</span>
                          </td>
                          <td className="px-0 sm:px-4 py-1 sm:py-3 text-[#041627] flex items-center justify-between sm:table-cell">
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Recorded:</span>
                            <span>{originalLine?.quantity || 0}</span>
                          </td>
                          <td className="px-0 sm:px-4 py-2 sm:py-3 flex items-center justify-between sm:table-cell">
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="sm:hidden text-xs text-gray-500 font-bold uppercase">Qty:</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                min={0}
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
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Reason (Optional)
              </label>
              <input
                type="text"
                className="input text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for adjustment (e.g. Stock Take, Damage)"
                autoFocus
              />
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
