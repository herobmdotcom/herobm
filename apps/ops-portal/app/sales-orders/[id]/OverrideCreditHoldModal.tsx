import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface OverrideCreditHoldModalProps {
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OverrideCreditHoldModal({ orderId, onClose, onSuccess }: OverrideCreditHoldModalProps) {
  const t = useTranslations();
  const tSales = useTranslations('salesOrders');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error(tSales('creditHold.noReasonError'));
      return;
    }
    setSubmitting(true);
    try {
      await api.ordersControllerOverrideCreditHold(orderId, { reason });
      toast.success(tSales('creditHold.success'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{tSales('creditHold.title')}</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {tSales('creditHold.description')}
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {tSales('creditHold.reasonLabel')}
              </label>
              <textarea
                className="input w-full min-h-[100px] resize-y"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tSales('creditHold.reasonPlaceholder')}
                required
                disabled={submitting}
              />
            </div>
          </div>
          
          <div className="px-6 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              className="!bg-amber-600 hover:!bg-amber-700 !text-white"
              disabled={submitting || !reason.trim()}
            >
              {submitting ? tSales('creditHold.overriding') : tSales('creditHold.overrideBtn')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
