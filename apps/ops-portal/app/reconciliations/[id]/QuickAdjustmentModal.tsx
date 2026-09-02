import React from 'react';
import SlideOver from '@/components/shared/SlideOver';
import QuickAdjustmentForm from './QuickAdjustmentForm';
import { useTranslations } from 'next-intl';

interface QuickAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationId: string;
  onSuccess: () => void;
}

export default function QuickAdjustmentModal({
  isOpen,
  onClose,
  reconciliationId,
  onSuccess
}: QuickAdjustmentModalProps) {
  const t = useTranslations('gl.reconciliations');

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('quickAdjustmentForm.title')}
    >
      <div className="p-4">
        <QuickAdjustmentForm
          reconciliationId={reconciliationId}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      </div>
    </SlideOver>
  );
}
