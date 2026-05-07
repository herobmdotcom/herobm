'use client';

import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

interface ReallocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDemands: any[];
  onSuccess: () => void;
}

export default function ReallocateModal({
  isOpen,
  onClose,
  selectedDemands,
  onSuccess,
}: ReallocateModalProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch<any>('/api/inventory/locations')
        .then((res) => {
          setLocations(res.data || []);
          if (res.data?.length > 0) {
            setSelectedLocationId(res.data[0].locationId);
          }
        })
        .catch((err) => reportError(err, 'Failed to load locations'));
    }
  }, [isOpen]);

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
              {locations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.code} - {loc.name}
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
            {isSubmitting ? 'Reallocating...' : 'Confirm Reallocation'}
          </button>
        </div>
      </div>
    </div>
  );
}
