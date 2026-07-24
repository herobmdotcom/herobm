import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { SnapshotTabContainer } from '@/components/shared/SnapshotTabContainer';

export const tabLabel = "M&A: Buy";
export default function BuyerQualificationsTab({
  actorId,
}: {
  actorId: string;
}) {
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.maGetBuyerQualifications(actorId) as any;
      setQualifications(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load qualifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [actorId]);

  const handleCreate = async (initialData: any = {}) => {
    try {
      setLoading(true);
      await api.maAddBuyerQualification(actorId, initialData);
      toast.success('Snapshot created');
      await loadData();
    } catch (err) {
      toast.error('Failed to create snapshot');
      setLoading(false);
    }
  };

  const handleUpdate = async (qualificationId: string, field: string, value: any) => {
    try {
      await api.maUpdateBuyerQualification(actorId, qualificationId, { [field]: value } as any);
      toast.success('Saved');
      setQualifications(prev => prev.map(q => q.qualificationId === qualificationId ? { ...q, [field]: value } : q));
    } catch (err) {
      toast.error('Failed to save field');
    }
  };

  return (
    <SnapshotTabContainer
      title="Buyer Qualifications"
      icon="shopping_cart"
      items={qualifications}
      loading={loading}
      idField="qualificationId"
      onUpdate={handleUpdate}
      onCreate={handleCreate}
      renderFields={(item, isLatest, updateField) => (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Buyer Activity</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.buyerActivity || ''}
                onBlur={e => {
                  if (e.target.value !== item.buyerActivity) {
                    updateField('buyerActivity', e.target.value);
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Geography</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.geography || ''}
                onBlur={e => {
                  if (e.target.value !== item.geography) {
                    updateField('geography', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Size Criteria</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.sizeCriteria || ''}
                onBlur={e => {
                  if (e.target.value !== item.sizeCriteria) {
                    updateField('sizeCriteria', e.target.value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Financial Capacity</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.financialCapacity || ''}
                onBlur={e => {
                  if (e.target.value !== item.financialCapacity) {
                    updateField('financialCapacity', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Strategic Fit</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.strategicFit || ''}
                onBlur={e => {
                  if (e.target.value !== item.strategicFit) {
                    updateField('strategicFit', e.target.value);
                  }
                }}
              />
            </div>
          </div>
        </>
      )}
    />
  );
}
