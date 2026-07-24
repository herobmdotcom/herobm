import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { SnapshotTabContainer } from '@/components/shared/SnapshotTabContainer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectActorWithDetails = any;

export default function FeedbackTab({ projectId, actors }: { projectId: string; actors: ProjectActorWithDetails[] }) {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await api.maControllerGetFeedback(projectId) as any;
      setFeedbacks(res.data || []);
    } catch (e) {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, [projectId]);

  const handleCreate = async (initialData: any = {}) => {
    try {
      if (actors.length === 0) {
        toast.error('Please add actors to the project first.');
        return;
      }
      // If we don't have an actorId in the initial data, default to the first actor
      const actorId = initialData.actorId || actors[0].actor.actorId;
      
      setLoading(true);
      await api.maControllerAddFeedback(projectId, { ...initialData, actorId });
      toast.success('Feedback snapshot created');
      await loadFeedbacks();
    } catch (e) {
      toast.error('Failed to create feedback');
      setLoading(false);
    }
  };

  const handleUpdate = async (feedbackId: string, field: string, value: any) => {
    try {
      await api.maControllerUpdateFeedback(projectId, feedbackId, { [field]: value } as any);
      toast.success('Saved');
      setFeedbacks(prev => prev.map(f => f.feedbackId === feedbackId ? { ...f, [field]: value } : f));
    } catch (e) {
      toast.error('Failed to save field');
    }
  };

  return (
    <SnapshotTabContainer
      title="Project Feedback"
      icon="feedback"
      items={feedbacks}
      loading={loading}
      idField="feedbackId"
      onUpdate={handleUpdate}
      onCreate={handleCreate}
      renderFields={(item, isLatest, updateField) => {
        // Find the actor name for historical snapshots if not editing
        const actorName = actors.find(a => a.actor.actorId === item.actorId)?.actor.name || 'Unknown Actor';

        return (
          <>
            {isLatest ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Actor</label>
                  <select
                    className="input w-full"
                    value={item.actorId || (actors.length > 0 ? actors[0].actor.actorId : '')}
                    onChange={e => updateField('actorId', e.target.value)}
                  >
                    {actors.map(link => (
                      <option key={link.actor.actorId} value={link.actor.actorId}>
                        {link.actor.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <span className="text-xs font-medium text-gray-500 uppercase">Actor:</span>
                <span className="ml-2 text-sm text-gray-800">{actorName}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Deal Proposal Reason</label>
                <textarea
                  className="input w-full min-h-[100px]"
                  defaultValue={item.dealProposalReason || ''}
                  onBlur={e => {
                    if (e.target.value !== item.dealProposalReason) {
                      updateField('dealProposalReason', e.target.value);
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Deal Refusal Reason</label>
                <textarea
                  className="input w-full min-h-[100px]"
                  defaultValue={item.dealRefusalReason || ''}
                  onBlur={e => {
                    if (e.target.value !== item.dealRefusalReason) {
                      updateField('dealRefusalReason', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </>
        );
      }}
    />
  );
}
