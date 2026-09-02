import React, { useState } from 'react';
import { Button } from '@/components/shared/Button';

export interface SnapshotItem {
  snapshotName?: string;
  asOfDate?: string;
  [key: string]: unknown;
}

export interface SnapshotTabContainerProps<T extends SnapshotItem> {
  title: string;
  icon: string;
  items: T[];
  loading: boolean;
  idField: keyof T;
  onUpdate: (id: string, field: string, value: unknown) => Promise<void>;
  onCreate: (initialData?: Partial<T>) => Promise<void>;
  renderFields: (item: Partial<T>, isLatest: boolean, handleUpdate: (field: string, value: unknown) => void) => React.ReactNode;
}

export function SnapshotTabContainer<T extends SnapshotItem>({
  title,
  icon,
  items,
  loading,
  idField,
  onUpdate,
  onCreate,
  renderFields,
}: SnapshotTabContainerProps<T>) {
  const [creating, setCreating] = useState(false);
  // Draft state for when there are 0 items
  const [draft, setDraft] = useState<Partial<T>>({});

  const handleDraftUpdate = async (field: string, value: unknown) => {
    if (creating) return;
    
    // Ignore empty values to prevent creating an empty snapshot when clicking in and out
    if (value === '' || value === null || value === undefined) return;

    const newDraft = { ...draft, [field]: value };
    setDraft(newDraft);
    
    setCreating(true);
    try {
      await onCreate(newDraft);
      setDraft({});
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNew = async () => {
    setCreating(true);
    try {
      await onCreate({});
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="card max-w-5xl flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h3 className="section-heading m-0">
          <span className="material-symbols-outlined">{icon}</span>
          {title.toUpperCase()}
        </h3>
      </div>

      {loading && items.length === 0 && !creating ? (
        <div className="p-4 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col gap-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Snapshot Name</label>
              <input
                type="text"
                className="input w-full"
                value={draft.snapshotName || ''}
                onChange={e => setDraft({ ...draft, snapshotName: e.target.value })}
                onBlur={e => handleDraftUpdate('snapshotName', e.target.value)}
                placeholder="e.g. Q3 Assessment"
                disabled={creating}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">As of Date</label>
              <input
                type="date"
                className="input w-full"
                value={draft.asOfDate ? new Date(draft.asOfDate).toISOString().substring(0, 10) : ''}
                onChange={e => setDraft({ ...draft, asOfDate: e.target.value })}
                onBlur={e => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                  handleDraftUpdate('asOfDate', val);
                }}
                disabled={creating}
              />
            </div>
          </div>
          {renderFields(
            draft,
            true,
            (field, value) => handleDraftUpdate(field, value)
          )}
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={handleCreateNew} disabled={creating || loading}>
              Add New Snapshot
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8 mt-4">
          {items.map((item, index) => {
            const isLatest = index === 0;
            const itemId = item[idField] as unknown as string;

            return (
              <div key={itemId} className="flex flex-col gap-4">
                {index > 0 && <hr className="border-gray-200" />}

                {!isLatest ? (
                  <>
                    <h4 className="text-sm font-semibold text-gray-800">
                      {(() => {
                        const fallbackName = 'Unnamed Snapshot';
                        return item.snapshotName || fallbackName;
                      })()}
                    </h4>
                    {renderFields(
                      item,
                      false,
                      (field, value) => onUpdate(itemId, field, value)
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Snapshot Name</label>
                        <input
                          type="text"
                          className="input w-full"
                          defaultValue={item.snapshotName || ''}
                          onBlur={e => {
                            if (e.target.value !== item.snapshotName) {
                              onUpdate(itemId, 'snapshotName', e.target.value);
                            }
                          }}
                          placeholder="e.g. Q3 Assessment"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">As of Date</label>
                        <input
                          type="date"
                          className="input w-full"
                          defaultValue={item.asOfDate ? new Date(item.asOfDate).toISOString().substring(0, 10) : ''}
                          onBlur={e => {
                            const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                            if (val !== item.asOfDate) {
                              onUpdate(itemId, 'asOfDate', val);
                            }
                          }}
                        />
                      </div>
                    </div>
                    {renderFields(
                      item,
                      true,
                      (field, value) => onUpdate(itemId, field, value)
                    )}
                    <div className="flex justify-end pt-2">
                      <Button variant="primary" onClick={handleCreateNew} disabled={creating || loading}>
                        Add New Snapshot
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
