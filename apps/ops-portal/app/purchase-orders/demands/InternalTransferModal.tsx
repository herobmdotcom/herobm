'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  buildInternalTransferSourceOptions,
  type InternalTransferSourceOption,
} from './internal-transfer-utils';

interface SelectedDemandLike {
  id: string;
  productId?: string;
  locationId?: string;
}

interface InternalTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDemands: SelectedDemandLike[];
  onSuccess: () => void;
}

interface RawLocationWithAvailability {
  locationId: string;
  code?: string;
  name: string;
  /** Only present when the endpoint is called with a productId. */
  availableQty?: number;
}

export default function InternalTransferModal({
  isOpen,
  onClose,
  selectedDemands,
  onSuccess,
}: InternalTransferModalProps) {
  const t = useTranslations('purchaseOrders');
  const [locations, setLocations] = useState<RawLocationWithAvailability[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch locations with availability when the modal opens. The API
  // returns `availableQty` per location when `productId` is supplied —
  // unlike Reallocate we cannot use the demand row's `availableElsewhere`
  // here because the source dropdown must include every location, not
  // just those with stock (zero-stock sources are still pickable so a
  // user can pre-empt an inbound receipt).
  useEffect(() => {
    if (!isOpen) return;
    const productId = selectedDemands[0]?.productId;
    const url = productId
      ? `/api/inventory/locations?productId=${encodeURIComponent(productId)}`
      : `/api/inventory/locations`;
    apiFetch<{ data: RawLocationWithAvailability[] }>(url)
      .then((res) => {
        setLocations(res.data || []);
      })
      .catch((err) => reportError(err, 'InternalTransferModal'));
  }, [isOpen, selectedDemands]);

  const destLocId = selectedDemands[0]?.locationId;

  const options = useMemo<InternalTransferSourceOption[]>(() => {
    return buildInternalTransferSourceOptions(locations, destLocId);
  }, [locations, destLocId]);

  // Pre-select the source with the highest available qty. If all sources
  // are at zero stock, fall back to the first in the list (per AC).
  useEffect(() => {
    if (options.length === 0) {
      setSelectedLocationId('');
      return;
    }
    const best = [...options].sort(
      (a, b) => b.availableQty - a.availableQty,
    )[0];
    if (best && best.availableQty > 0) {
      setSelectedLocationId(best.locationId);
    } else {
      setSelectedLocationId(options[0].locationId);
    }
  }, [options]);

  const handleSubmit = async () => {
    if (!selectedLocationId) return;

    // Verify all demands are for the same destination
    const expectedDest = selectedDemands[0]?.locationId;
    if (!selectedDemands.every(d => d.locationId === expectedDest)) {
      toast.error('All demands must be for the same destination location');
      return;
    }

    setIsSubmitting(true);
    try {
      const backorderIds = selectedDemands.map(d => d.id);
      await apiFetch('/api/transfers/from-demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocationId: selectedLocationId,
          backorderIds,
        }),
      });

      toast.success('Internal Transfer order created successfully');
      onSuccess();
    } catch (err) {
      reportError(err, 'InternalTransferModal');
      toast.error('Failed to create transfer order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Create Internal Transfer
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Create a Transfer Order to fulfill {selectedDemands.length} demands from another location.
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Source Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full h-10 px-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              disabled={isSubmitting || options.length === 0}
            >
              {options.map((opt) => (
                <option key={opt.locationId} value={opt.locationId}>
                  {opt.label}
                </option>
              ))}
            </select>
            {options.length === 0 && (
              <p className="text-sm text-[var(--danger)] mt-1">No other locations available.</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg-secondary)] rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--bg-card-hover)] transition-colors text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || options.length === 0}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                {t('demands.creating')}
              </>
            ) : (
              t('demands.createTransfer')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
