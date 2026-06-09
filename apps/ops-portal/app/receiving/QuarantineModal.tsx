'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { reportError } from '@/lib/api';
import SlideOver from '@/components/shared/SlideOver';
import { BIN_TYPE } from '@modbm/shared';

interface QuarantineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, binId?: string) => Promise<void>;
  locationId: string;
}

export default function QuarantineModal({ isOpen, onClose, onSubmit, locationId }: QuarantineModalProps) {
  const [reason, setReason] = useState('');
  const [binId, setBinId] = useState('');
  const [bins, setBins] = useState<{ binId: string; binNumber: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations('goodsReceived');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (isOpen && locationId) {
      setReason('');
      setLoading(true);
      api.inventoryControllerFindAllLocations()
        .then((res) => {
          const locs = res.data || [];
          const loc = locs.find((l: any) => l.locationId === locationId) as any;
          if (loc && loc.zones) {
            const quarantineBins: { binId: string; binNumber: string }[] = [];
            loc.zones.forEach((z: any) => {
              if (z.bins) {
                z.bins.forEach((b: any) => {
                  if (b.binType === BIN_TYPE.QUARANTINE) {
                    quarantineBins.push(b);
                  }
                });
              }
            });
            setBins(quarantineBins);
            if (quarantineBins.length > 0) {
              setBinId(quarantineBins[0].binId);
            } else {
              setBinId('');
            }
          }
        })
        .catch((err) => reportError(err, 'QuarantineModal.fetchBins'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, locationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(reason, binId || undefined);
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
        form="quarantine-form"
        disabled={submitting || loading || (bins.length > 0 && !binId)}
        className="btn btn-primary font-bold"
      >
        {submitting ? tCommon('saving') : t('buttons.quarantine')}
      </button>
    </div>
  );

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('quarantine.title')}
      width="max-w-md"
      footer={footerActions}
    >
      <div className="flex flex-col gap-4 p-4 -mt-4">
        {loading ? (
          <div className="text-sm text-[var(--text-muted)] text-center py-8">{tCommon('loading')}</div>
        ) : (
          <form id="quarantine-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('quarantine.destinationBin')}
              </label>
              {bins.length > 0 ? (
                <select
                  className="input text-sm"
                  value={binId}
                  onChange={(e) => setBinId(e.target.value)}
                  required
                >
                  {bins.map(b => (
                    <option key={b.binId} value={b.binId}>
                      {b.binNumber}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-[var(--text-secondary)] italic">
                  {t('quarantine.noBinsFound')}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t('quarantine.reasonOptional')}
              </label>
              <input
                type="text"
                className="input text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are these items being quarantined?"
                autoFocus
              />
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
