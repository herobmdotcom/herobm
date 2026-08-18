import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';

interface PartialAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  invoice: Record<string, any> | null;
  currencyCode: string;
  maxAvailable: number; // The maximum amount that can be allocated (lesser of payment remaining or invoice outstanding)
  onSave: (invoiceId: string, amount: number, discountAmount: number) => void;
}

export default function PartialAllocationModal({
  isOpen,
  onClose,
  invoice,
  currencyCode,
  maxAvailable,
  onSave
}: PartialAllocationModalProps) {
  const t = useTranslations('payments.partialAllocation');
  const tCommon = useTranslations('common');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');

  // Reset amount when modal opens or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(invoice.pendingAllocation > 0 ? String(invoice.pendingAllocation) : '');
      setDiscount(invoice.pendingDiscountAmount > 0 ? String(invoice.pendingDiscountAmount) : '');
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const handleSave = () => {
    const val = parseFloat(amount) || 0;
    const discountVal = parseFloat(discount) || 0;
    if (val > maxAvailable && val !== invoice.pendingAllocation) {
      // Allow saving if they aren't increasing it beyond maxAvailable, 
      // but ideally they just shouldn't be able to exceed maxAvailable
      alert(`Amount cannot exceed the maximum available of ${formatAmount(maxAvailable, currencyCode)}`);
      return;
    }
    onSave(invoice.id, val, discountVal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('title')}</h2>
          <Button variant="ghost" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">

            <span className="material-symbols-outlined text-xl">close</span>
          </Button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-[#f0f8f6] border border-[#006b5c]/30 p-4 rounded-lg flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-[#006b5c]">{t('invoice')}</span>
              <span className="font-medium text-[#041627]">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-[#006b5c]">{t('outstanding')}</span>
              <span className="font-medium text-[#041627]">{formatAmount(parseFloat(invoice.outstandingAmount), currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#006b5c]/20">
              <span className="font-bold text-[#006b5c]">{t('maxAvailable')}</span>
              <span className="font-medium text-[#041627]">{formatAmount(maxAvailable, currencyCode)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              {t('amountToAllocate')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">
                {formatAmount(0, currencyCode).replace(/[0-9.,]/g, '').trim()}
              </span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#006b5c] focus:border-transparent transition-all font-mono text-lg"
                placeholder="0.00"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          </div>
          
          <div>
            { }
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Discount Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">
                {formatAmount(0, currencyCode).replace(/[0-9.,]/g, '').trim()}
              </span>
              <input
                type="number"
                step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[#006b5c] focus:border-transparent transition-all font-mono text-lg"
                placeholder="0.00"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" className="px-8" onClick={handleSave}>
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
