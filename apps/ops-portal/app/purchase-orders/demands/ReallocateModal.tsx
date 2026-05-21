'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  buildReallocateLocationOptions,
  type ReallocateLocationOption,
} from './reallocate-utils';
import type { AvailableElsewhereEntry } from './stock-elsewhere-utils';

interface SelectedDemandLike {
  id: string;
  productId?: string;
  locationId?: string;
  availableElsewhere?: AvailableElsewhereEntry[];
}

interface ReallocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDemands: SelectedDemandLike[];
  onSuccess: () => void;
}

interface RawLocation {
  locationId: string;
  code?: string;
  name: string;
}

export default function ReallocateModal({
  isOpen,
  onClose,
  selectedDemands,
  onSuccess,
}: ReallocateModalProps) {
  const t = useTranslations('purchaseOrders');
  const [locations, setLocations] = useState<RawLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch<{ data: RawLocation[] }>('/api/inventory/locations')
        .then((res) => {
          setLocations(res.data || []);
        })
        .catch((err) => reportError(err, 'Failed to load locations'));
    }
  }, [isOpen]);

  // Merge fetched locations with `availableElsewhere` from the first
  // selected demand. `availableElsewhere` omits zero-stock locations
  // server-side, so we backfill those with 0 to keep them clickable
  // (acceptance criteria: zero-stock locations are shown, not disabled).
  const options = useMemo<ReallocateLocationOption[]>(() => {
    const availability = selectedDemands[0]?.availableElsewhere ?? [];
    return buildReallocateLocationOptions(locations, availability);
  }, [locations, selectedDemands]);

  // Whenever options change, pre-select the entry with the highest
  // available qty, falling back to the first location.
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

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedLocationId || selectedDemands.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const demand of selectedDemands) {
        await apiFetch(`/api/allocations/${demand.id}/reallocate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: selectedLocationId }),
        });
      }
      toast.success(`Successfully reallocated ${selectedDemands.length} line(s)`);
      onSuccess();
    } catch (err: any) {
      reportError(err, 'Failed to reallocate demands');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-xl w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-secondary)] rounded-t-md">
          <h2 className="text-lg font-bold text-[var(--text-primary)] font-['Manrope']">
            Reallocate Location
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-[var(--text-secondary)]">
            You are reallocating <strong>{selectedDemands.length}</strong> demand line(s).
            This will update the Sales Order line's fulfillment location and reset any existing PO allocations for these lines.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              New Fulfillment Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="input w-full"
              disabled={isSubmitting}
            >
              {options.map((opt) => (
                <option key={opt.locationId} value={opt.locationId}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[#f8fafc] rounded-b-md">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded bg-white hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedLocationId}
            className="px-4 py-2 text-sm font-bold bg-[var(--accent)] text-white rounded hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? t('demands.reallocating') : t('demands.confirmReallocation')}
          </button>
        </div>
      </div>
    </div>
  );
}
