/* eslint-disable @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */

import React, { useState, useEffect, useMemo } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';

interface PaymentRunGeneratorSlideOverProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  baseCurrency: string;
}

export function PaymentRunGeneratorSlideOver({
  open,
  onClose,
  onSuccess,
  baseCurrency,
}: PaymentRunGeneratorSlideOverProps) {
  const t = useTranslations('portal');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [glAccountBank, setGlAccountBank] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [generating, setGenerating] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);
  const [candidates, setCandidates] = useState<api.PaymentRunCandidateResponseDto[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Sections collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    due: true,
    discount: true,
    other: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (open) {
      api.glControllerGetAccounts({ isBankAccount: 'true' })
        .then((res) => {
          const banks = res.data || [];
          setBankAccounts(banks.map((a) => ({ id: a.glAccountId, name: `${a.accountCode} - ${a.name}` })));
        })
        .catch(() => {
          // ignore
        });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !targetDate) return;
    
    let isCurrent = true;
    setFetching(true);
    
    api.paymentsControllerGetPaymentRunCandidates({ targetDate })
      .then((res: any) => {
        if (!isCurrent) return;
        const data = res.data || [];
        setCandidates(data);
        
        // Default selection: everything "Due this week"
        const initialSelected = new Set<string>();
        data.forEach((c: any) => {
          if (c.isDueSoon) {
            initialSelected.add(c.invoiceId);
          }
        });
        setSelectedInvoiceIds(initialSelected);
        setBudgetAmount(''); // clear budget when target date changes
      })
      .catch((err: any) => {
        if (!isCurrent) return;
        toast.error('Failed to load candidates: ' + getErrorMessage(err));
      })
      .finally(() => {
        if (isCurrent) setFetching(false);
      });
      
    return () => {
      isCurrent = false;
    };
  }, [open, targetDate]);

  const handleGenerate = async () => {
    if (!targetDate || !glAccountBank) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (selectedInvoiceIds.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.paymentsControllerGeneratePaymentRun({
        targetDate,
        glAccountBank,
        invoiceIds: Array.from(selectedInvoiceIds)
      });

      const data = res.data;
      if (data.generatedPayments > 0) {
        toast.success(`Generated ${data.generatedPayments} payments totaling ${data.totalCashAmount.toFixed(2)} ${baseCurrency}`);
        onSuccess();
        onClose();
      } else {
        toast('No eligible invoices found to generate payments for.', { icon: 'ℹ️' });
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to generate payment run');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // If they manually toggle, we might want to clear the budget input so they know it's detached from auto-selection
    setBudgetAmount('');
  };

  const handleApplyBudget = () => {
    const budget = parseFloat(budgetAmount);
    if (isNaN(budget) || budget <= 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }

    // Sort candidates: Due first, then Discount, then Other
    // Within each group, sort by dueDate asc
    const groupScore = (c: api.PaymentRunCandidateResponseDto) => {
      if (c.isDueSoon) return 1;
      if (c.hasDiscountOpportunity) return 2;
      return 3;
    };

    const sorted = [...candidates].sort((a, b) => {
      const scoreA = groupScore(a);
      const scoreB = groupScore(b);
      if (scoreA !== scoreB) return scoreA - scoreB;
      
      const dateA = new Date(a.dueDate as unknown as string).getTime();
      const dateB = new Date(b.dueDate as unknown as string).getTime();
      return dateA - dateB;
    });

    let remaining = budget;
    const nextSelected = new Set<string>();

    let previousSection = -1;
    let currentSectionHasUnselected = false;

    for (const c of sorted) {
      const section = groupScore(c);
      
      // Prevent selecting from lower sections if higher priority sections couldn't be fully satisfied
      if (previousSection !== -1 && section !== previousSection && currentSectionHasUnselected) {
        break;
      }
      previousSection = section;

      if (remaining >= c.cashAmount) {
        nextSelected.add(c.invoiceId);
        remaining -= c.cashAmount;
      } else {
        currentSectionHasUnselected = true;
      }
    }

    setSelectedInvoiceIds(nextSelected);
    toast.success(`Allocated budget across ${nextSelected.size} invoices`);
  };

  // Group candidates
  const dueSoon = useMemo(() => candidates.filter(c => c.isDueSoon), [candidates]);
  const discountOpps = useMemo(() => candidates.filter(c => c.hasDiscountOpportunity && !c.isDueSoon), [candidates]);
  const others = useMemo(() => candidates.filter(c => !c.isDueSoon && !c.hasDiscountOpportunity), [candidates]);

  const totalSelectedCash = useMemo(() => {
    return candidates.reduce((sum, c) => selectedInvoiceIds.has(c.invoiceId) ? sum + c.cashAmount : sum, 0);
  }, [candidates, selectedInvoiceIds]);

  const renderSection = (title: string, key: string, items: api.PaymentRunCandidateResponseDto[]) => {
    if (items.length === 0) return null;
    const isExpanded = expandedSections[key];
    
    return (
      <div className="mb-6">
        <button 
          className="flex items-center gap-2 w-full text-left font-bold text-gray-800 mb-2 hover:bg-gray-50 p-1 rounded"
          onClick={() => toggleSection(key)}
        >
          {isExpanded ? (
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          )}
          {title} <span className="text-gray-500 font-normal text-sm ml-2">({items.length})</span>
        </button>
        
        {isExpanded && (
          <div className="overflow-x-auto mt-2 mb-4">
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={items.every(i => selectedInvoiceIds.has(i.invoiceId))}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedInvoiceIds(prev => {
                          const next = new Set(prev);
                          items.forEach(i => checked ? next.add(i.invoiceId) : next.delete(i.invoiceId));
                          return next;
                        });
                        setBudgetAmount('');
                      }}
                    />
                  </th>
                  <th className="text-left font-medium text-gray-500">{t('invoice')}</th>
                  <th className="text-left font-medium text-gray-500">{t('supplier')}</th>
                  <th className="text-left font-medium text-gray-500">{t('dueDate')}</th>
                  <th className="text-right font-medium text-gray-500">{t('total')}</th>
                  <th className="text-right font-medium text-gray-500">{t('discount')}</th>
                  <th className="text-right font-medium text-gray-500">{t('toPay')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.invoiceId}>
                    <td className="text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedInvoiceIds.has(inv.invoiceId)}
                        onChange={() => handleToggleInvoice(inv.invoiceId)}
                      />
                    </td>
                    <td className="text-gray-900">{inv.invoiceNumber}</td>
                    <td className="text-gray-600 truncate max-w-[150px]" title={inv.supplierName}>{inv.supplierName}</td>
                    <td className="text-gray-600">
                      {new Date(inv.dueDate as unknown as string).toLocaleDateString()}
                    </td>
                    <td className="text-right text-gray-600">
                      ${Number(inv.outstandingAmount).toFixed(2)}
                    </td>
                    <td className="text-right text-gray-500">
                      {inv.discountAmount > 0 ? `-$${inv.discountAmount.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-right font-medium text-gray-900">
                      ${inv.cashAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <SlideOver isOpen={open} onClose={onClose} title={t('generatePaymentRun')} width="max-w-3xl">
      <div className="flex flex-col h-full">
        
        {/* Sticky Header Config */}
        <div className="px-6 pt-6 pb-2 z-10">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                {t('targetDate')}
              </label>
              <input
                type="date"
                className="input w-full"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={generating || fetching}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                {t('bankAccount')}
              </label>
              <select
                className="input w-full"
                value={glAccountBank}
                onChange={(e) => setGlAccountBank(e.target.value)}
                disabled={generating}
              >
                <option value="">{t('selectBankAccount')}</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-end gap-3 mt-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                {t('autoSelectByBudget')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
                className="input w-full bg-white"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyBudget()}
              />
            </div>
            <button 
              onClick={handleApplyBudget}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50 transition-colors text-sm h-10"
            >
              {t('apply')}
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {fetching ? (
            <div className="text-center py-10 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#006b5c] mx-auto mb-4"></div>
              {t('findingEligibleInvoices')}
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              {t('noUnpaidInvoices')}
            </div>
          ) : (
            <div>
              {renderSection(t('dueThisWeek'), 'due', dueSoon)}
              {renderSection(t('eligibleForEarlyPaymentDiscount'), 'discount', discountOpps)}
              {renderSection(t('otherInvoices'), 'other', others)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <div className="font-medium text-gray-900">
            { }
            {t('totalSelected')}: ${totalSelectedCash.toFixed(2)} ({selectedInvoiceIds.size} {t('invoices')})
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
              disabled={generating}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedInvoiceIds.size === 0}
              className="px-6 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? t('generating') : t('generateRun')}
            </button>
          </div>
        </div>

      </div>
    </SlideOver>
  );
}
