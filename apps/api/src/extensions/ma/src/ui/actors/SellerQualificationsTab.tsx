import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { SnapshotTabContainer } from '@/components/shared/SnapshotTabContainer';

export const tabLabel = "M&A: Sell";
export default function SellerQualificationsTab({
  actorId,
}: {
  actorId: string;
}) {
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.maGetSellerQualifications(actorId) as any;
      setQualifications(res.data || []);
    } catch (e) {
      toast.error('Failed to load seller qualifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actorId) loadData();
  }, [actorId]);

  const handleCreate = async (initialData: any = {}) => {
    try {
      setLoading(true);
      await api.maAddSellerQualification(actorId, initialData);
      toast.success('Snapshot created');
      await loadData();
    } catch (err) {
      toast.error('Failed to create snapshot');
      setLoading(false);
    }
  };

  const handleUpdate = async (qualificationId: string, field: string, value: any) => {
    try {
      await api.maUpdateSellerQualification(actorId, qualificationId, { [field]: value } as any);
      toast.success('Saved');
      setQualifications(prev => prev.map(q => q.qualificationId === qualificationId ? { ...q, [field]: value } : q));
    } catch (err) {
      toast.error('Failed to save field');
    }
  };

  return (
    <SnapshotTabContainer
      title="Seller Qualifications"
      icon="sell"
      items={qualifications}
      loading={loading}
      idField="qualificationId"
      onUpdate={handleUpdate}
      onCreate={handleCreate}
      renderFields={(item, isLatest, updateField) => (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Market Context</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.marketContext || ''}
                onBlur={e => {
                  if (e.target.value !== item.marketContext) {
                    updateField('marketContext', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Competitive Environment</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.competitiveEnvironment || ''}
                onBlur={e => {
                  if (e.target.value !== item.competitiveEnvironment) {
                    updateField('competitiveEnvironment', e.target.value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Market Trends</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.marketTrends || ''}
                onBlur={e => {
                  if (e.target.value !== item.marketTrends) {
                    updateField('marketTrends', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Added Value</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.addedValue || ''}
                onBlur={e => {
                  if (e.target.value !== item.addedValue) {
                    updateField('addedValue', e.target.value);
                  }
                }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Specific Clients</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.specificClients || ''}
                onBlur={e => {
                  if (e.target.value !== item.specificClients) {
                    updateField('specificClients', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Business Model</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.businessModel || ''}
                onBlur={e => {
                  if (e.target.value !== item.businessModel) {
                    updateField('businessModel', e.target.value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Consolidation Perspectives</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.consolidationPerspectives || ''}
                onBlur={e => {
                  if (e.target.value !== item.consolidationPerspectives) {
                    updateField('consolidationPerspectives', e.target.value);
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-[22px]">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                defaultChecked={item.interestedBuyersExist}
                onBlur={e => {
                  if (e.target.checked !== item.interestedBuyersExist) {
                    updateField('interestedBuyersExist', e.target.checked);
                  }
                }}
                onChange={e => {
                  // Optimistic local update via standard React state flow inside SnapshotTabContainer
                  updateField('interestedBuyersExist', e.target.checked);
                }}
              />
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Interested Buyers Exist
              </label>
            </div>
          </div>
        </>
      )}
    />
  );
}
