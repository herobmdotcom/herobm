'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { reportError } from '@/lib/api';

interface LineEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: string;
}

export default function ManualBankLineEntry({
  glAccountId,
  onSuccess,
  onCancel,
}: {
  glAccountId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('admin.reconciliations');
  const tCommon = useTranslations('common');
  
  const [lines, setLines] = useState<LineEntry[]>([
    { id: '1', date: '', description: '', reference: '', amount: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: keyof LineEntry) => {
    if (e.key === 'Tab' && !e.shiftKey && index === lines.length - 1 && field === 'amount') {
      e.preventDefault();
      const newLineId = String(Date.now());
      setLines(prev => [...prev, { id: newLineId, date: prev[index].date, description: '', reference: '', amount: '' }]);
      
      // Focus new row date field on next tick
      setTimeout(() => {
        const inputs = containerRef.current?.querySelectorAll(`input[data-row-id="${newLineId}"][data-field="date"]`);
        if (inputs && inputs[0]) {
          (inputs[0] as HTMLInputElement).focus();
        }
      }, 10);
    }
  };

  const updateLine = (id: string, field: keyof LineEntry, value: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
    if (lines.length === 1) {
      setLines([{ id: String(Date.now()), date: '', description: '', reference: '', amount: '' }]);
    }
  };

  const handleSave = async () => {
    const validLines = lines.filter(l => l.date && l.description && l.amount);
    if (!validLines.length) {
      toast.error(t('noValidLines'));
      return;
    }

    try {
      setSaving(true);
      const dtos: api.CreateBankStatementLineDto[] = validLines.map(l => ({
        glAccountId,
        date: l.date,
        description: l.description,
        reference: l.reference || undefined,
        amount: Number(l.amount)
      }));

      await api.bankStatementControllerCreateLinesBulk(dtos);
      toast.success(t('linesCreated'));
      onSuccess();
    } catch (e) {
      reportError(e, 'CreateBankLines');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 overflow-y-auto flex-1" ref={containerRef}>
        <div className="text-sm text-[var(--text-secondary)] mb-4">
          {t('manualEntryHelp')}
        </div>
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b text-xs text-[var(--text-muted)] uppercase tracking-wider">
              <th className="pb-2 font-medium w-[120px]">{t('date')}</th>
              <th className="pb-2 font-medium">{t('description')}</th>
              <th className="pb-2 font-medium w-[150px]">{t('reference')}</th>
              <th className="pb-2 font-medium w-[120px] text-right">{t('amount')}</th>
              <th className="pb-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    data-row-id={line.id}
                    data-field="date"
                    value={line.date}
                    onChange={(e) => updateLine(line.id, 'date', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]"
                    placeholder="Description"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="text"
                    value={line.reference}
                    onChange={(e) => updateLine(line.id, 'reference', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]"
                    placeholder="Ref"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, 'amount', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, idx, 'amount')}
                    className="w-full px-2 py-1.5 border rounded text-sm text-right focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]"
                    placeholder="0.00"
                  />
                </td>
                <td className="py-2 text-center">
                  <button 
                    onClick={() => removeLine(line.id)}
                    className="text-[var(--text-muted)] hover:text-red-500"
                    title={tCommon('delete')}
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
        <button 
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100"
        >
          {tCommon('cancel')}
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50"
        >
          {saving ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
    </div>
  );
}
