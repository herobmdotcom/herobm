/* eslint-disable @typescript-eslint/no-explicit-any, i18next/no-literal-string, no-restricted-syntax */
import React, { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
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
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [glAccountBank, setGlAccountBank] = useState('');
  const [generating, setGenerating] = useState(false);

  // In a real app we'd fetch actual bank accounts via an endpoint, 
  // but for simplicity we will let the user type the GL Account UUID 
  // or fetch it from GL accounts where type is bank.
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (open) {
      api.glControllerGetAccounts({ isBankAccount: 'true' } as any)
        .then((res: any) => {
          const banks = res.data || [];
          setBankAccounts(banks.map((a: any) => ({ id: a.glAccountId, name: `${a.accountCode} - ${a.name}` })));
        })
        .catch(() => {
          // ignore
        });
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!targetDate || !glAccountBank) {
      toast.error('Please fill in all fields');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.paymentsControllerGeneratePaymentRun({
        targetDate,
        glAccountBank,
      });

      const data = res.data;
      if (data.generatedPayments > 0) {
        toast.success(`Generated ${data.generatedPayments} payments totaling ${data.totalCashAmount.toFixed(2)} ${baseCurrency}`);
        onSuccess();
        onClose();
      } else {
        toast('No eligible invoices found to generate payments for.', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Failed to generate payment run');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SlideOver isOpen={open} onClose={onClose} title="Generate Payment Run">
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Date
            </label>
            <input
              type="date"
              className="input w-full"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={generating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Account
            </label>
            <select
              className="input w-full"
              value={glAccountBank}
              onChange={(e) => setGlAccountBank(e.target.value)}
              disabled={generating}
            >
              <option value="">Select a Bank Account</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
            disabled={generating}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-[#006b5c] text-white rounded font-bold hover:brightness-110 transition-all text-sm whitespace-nowrap"
          >
            {generating ? 'Generating...' : 'Generate Run'}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
