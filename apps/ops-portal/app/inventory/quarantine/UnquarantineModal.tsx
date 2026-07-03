'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';
import { BIN_TYPE } from '@herobm/shared';

interface UnquarantineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, targetBinId: string) => Promise<void>;
  locationId: string;
}

export default function UnquarantineModal({ isOpen, onClose, onSubmit, locationId }: UnquarantineModalProps) {
  const [reason, setReason] = useState('');
  const [binId, setBinId] = useState('');
  const [bins, setBins] = useState<api.InventoryBinResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('goodsReceived');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen && locationId) {
      setReason('');
      setLoading(true);
      api.inventoryControllerFindBinsByLocation(locationId)
        .then((res) => {
          const allBins = res.data || [];
          const availableBins: api.InventoryBinResponseDto[] = [];
          
          allBins.forEach((b) => {
            if (b.binType !== BIN_TYPE.QUARANTINE) {
              availableBins.push(b);
            }
          });
          
          setBins(availableBins);
          
          // Default to the RECEIVING bin if one exists, otherwise just the first available
          const defaultBin = availableBins.find(b => b.binNumber === 'RECEIVING' && b.zoneCode === 'HANDLING') || availableBins[0];
          if (defaultBin) {
            setBinId(defaultBin.binId);
          } else {
            setBinId('');
          }
        })
        .catch((err) => reportError(err, 'UnquarantineModal.fetchBins'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, locationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binId) return;
    setSubmitting(true);
    try {
      await onSubmit(reason, binId);
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
        {t('quarantine.cancel')}
      </button>
      <button
        type="submit"
        form="unquarantine-form"
        disabled={submitting || loading || !binId}
        className="btn btn-primary font-bold"
      >
        {submitting ? tCommon('saving') : t('buttons.unquarantine')}
      </button>
    </div>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('quarantine.unquarantineTitle')}
      footer={footerActions}
    >
      <div className="flex flex-col gap-4 p-4 -mt-4">
        {loading ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">{tCommon('loading')}</div>
        ) : (
          <form id="unquarantine-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-muted)]">
                {t('quarantine.destinationBin')}
              </label>
              {bins.length > 0 ? (
                <select
                  className="input text-sm"
                  value={binId}
                  onChange={(e) => setBinId(e.target.value)}
                  required
                >
                  <option value="" disabled>{t('quarantine.selectBin')}</option>
                  {bins.map(b => (
                    <option key={b.binId} value={b.binId}>
                      {b.zoneCode ? `${b.zoneCode}.${b.binNumber}` : b.binNumber} ({b.binType})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-[var(--text-secondary)] italic">
                  {t('quarantine.noAvailableBins')}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-muted)]">
                {t('quarantine.reasonOptional')}
              </label>
              <input
                type="text"
                className="input text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are these items being unquarantined?"
                autoFocus
              />
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
