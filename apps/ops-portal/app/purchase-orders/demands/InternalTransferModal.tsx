'use client';

import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

interface InternalTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDemands: any[];
  onSuccess: () => void;
}

export default function InternalTransferModal({
  isOpen,
  onClose,
  selectedDemands,
  onSuccess,
}: InternalTransferModalProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch<any>('/api/inventory/locations')
        .then((res) => {
          // Exclude destination location (assuming all selected demands are for the same location)
          const destLocId = selectedDemands[0]?.locationId;
          const validLocations = (res.data || []).filter((loc: any) => loc.locationId !== destLocId);
          setLocations(validLocations);
          if (validLocations.length > 0) {
            setSelectedLocationId(validLocations[0].locationId);
          }
        })
        .catch((err) => reportError(err, 'InternalTransferModal'));
    }
  }, [isOpen, selectedDemands]);

  const handleSubmit = async () => {
    if (!selectedLocationId) return;

    // Verify all demands are for the same destination
    const destLocId = selectedDemands[0]?.locationId;
    if (!selectedDemands.every(d => d.locationId === destLocId)) {
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
              disabled={isSubmitting || locations.length === 0}
            >
              {locations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.name}
                </option>
              ))}
            </select>
            {locations.length === 0 && (
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
            disabled={isSubmitting || locations.length === 0}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                Creating...
              </>
            ) : (
              'Create Transfer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
