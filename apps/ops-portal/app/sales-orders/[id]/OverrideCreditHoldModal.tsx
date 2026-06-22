import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{tSales('creditHold.title')}</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 mb-4">
              {tSales('creditHold.description')}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600"
              disabled={submitting || !reason.trim()}
            >
              {submitting ? tSales('creditHold.overriding') : tSales('creditHold.overrideBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
