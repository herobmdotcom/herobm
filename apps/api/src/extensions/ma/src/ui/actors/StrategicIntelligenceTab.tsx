import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { SnapshotTabContainer } from '@/components/shared/SnapshotTabContainer';

export const tabLabel = "M&A: Intel";
export default function StrategicIntelligenceTab({
  actorId,
}: {
  actorId: string;
}) {
  const [intelligence, setIntelligence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.maGetStrategicIntelligence(actorId) as any;
      setIntelligence(res.data || []);
    } catch (e) {
      toast.error('Failed to load strategic intelligence');
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
      await api.maAddStrategicIntelligence(actorId, initialData);
      toast.success('Snapshot created');
      await loadData();
    } catch (err) {
      toast.error('Failed to create snapshot');
      setLoading(false);
    }
  };

  const handleUpdate = async (intelligenceId: string, field: string, value: any) => {
    try {
      await api.maUpdateStrategicIntelligence(actorId, intelligenceId, { [field]: value } as any);
      toast.success('Saved');
      setIntelligence(prev => prev.map(q => q.intelligenceId === intelligenceId ? { ...q, [field]: value } : q));
    } catch (err) {
      toast.error('Failed to save field');
    }
  };

  return (
    <SnapshotTabContainer
      title="Strategic Intelligence"
      icon="lightbulb"
      items={intelligence}
      loading={loading}
      idField="intelligenceId"
      onUpdate={handleUpdate}
      onCreate={handleCreate}
      renderFields={(item, isLatest, updateField) => (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Timeline</label>
              <input
                type="text"
                className="input w-full"
                defaultValue={item.timeline || ''}
                onBlur={e => {
                  if (e.target.value !== item.timeline) {
                    updateField('timeline', e.target.value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Manager Intent</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.managerIntent || ''}
                onBlur={e => {
                  if (e.target.value !== item.managerIntent) {
                    updateField('managerIntent', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Sector Interests</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.sectorInterests || ''}
                onBlur={e => {
                  if (e.target.value !== item.sectorInterests) {
                    updateField('sectorInterests', e.target.value);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>External Growth Projects</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.externalGrowthProjects || ''}
                onBlur={e => {
                  if (e.target.value !== item.externalGrowthProjects) {
                    updateField('externalGrowthProjects', e.target.value);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Future Sale Intent</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.futureSaleIntent || ''}
                onBlur={e => {
                  if (e.target.value !== item.futureSaleIntent) {
                    updateField('futureSaleIntent', e.target.value);
                  }
                }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Strategic Rationale</label>
              <textarea
                rows={3}
                className="input w-full"
                defaultValue={item.strategicRationale || ''}
                onBlur={e => {
                  if (e.target.value !== item.strategicRationale) {
                    updateField('strategicRationale', e.target.value);
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
