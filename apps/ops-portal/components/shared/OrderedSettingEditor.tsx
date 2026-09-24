import React, { useState, useEffect } from 'react';
import { InlineSettingsTable, InlineTableColumn } from './InlineSettingsTable';
import * as api from '@herobm/sdk';

export interface OrderedSettingEditorProps {
  title: React.ReactNode;
  items: api.OrderedSettingDto[];
  onChange: (items: api.OrderedSettingDto[]) => Promise<void>;
  columnTitle?: string;
  emptyLabel?: string;
}

export function OrderedSettingEditor({ title, items, onChange, columnTitle, emptyLabel }: OrderedSettingEditorProps) {
  const [data, setData] = useState<{ id: string; value: string; order: number; isSystem?: boolean }[]>([]);

  useEffect(() => {
    setData(
      (items || [])
        .map((val, i) => ({ id: `id-${i}-${val.value}`, value: val.value, order: val.order, isSystem: (val as api.OrderedSettingDto & { isSystem?: boolean }).isSystem }))
        .sort((a, b) => a.order - b.order)
    );
  }, [items]);

  const columns: InlineTableColumn<{ id: string; value: string; order: number; isSystem?: boolean }>[] = [
    { key: 'order', title: 'Order', type: 'number' },
    {
      key: 'value',
      title: columnTitle || 'Value',
      render: (row, isEditing, onRowChange) => {
        if (isEditing) {
          if (row.isSystem) {
            return (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="input w-full bg-[var(--bg-secondary)] cursor-not-allowed opacity-75"
                  value={row.value}
                  disabled
                  title="System role value cannot be renamed"
                />
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] font-semibold whitespace-nowrap">
                  System
                </span>
              </div>
            );
          }
          return (
            <input
              type="text"
              className="input w-full"
              value={row.value}
              onChange={(e) => onRowChange?.(e.target.value)}
            />
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span>{row.value}</span>
            {row.isSystem && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] font-medium">
                System
              </span>
            )}
          </div>
        );
      },
    }
  ];

  const handleSave = async (row: { id: string; value: string; order: number; isSystem?: boolean }, isNew: boolean) => {
    if (!row.value) return;
    const newData = [...data];
    if (isNew) {
      newData.push({ id: `id-${newData.length}-${crypto.randomUUID()}`, value: row.value, order: Number(row.order), isSystem: false });
    } else {
      const idx = newData.findIndex(d => d.id === row.id);
      if (idx !== -1) {
        newData[idx].value = row.value;
        newData[idx].order = Number(row.order);
        newData[idx].isSystem = row.isSystem;
      }
    }
    
    newData.sort((a, b) => a.order - b.order);

    // Optimistic update
    setData(newData);
    await onChange(newData.map(d => ({ value: d.value, order: d.order, isSystem: d.isSystem })));
  };

  const handleDelete = async (row: { id: string; value: string; order: number; isSystem?: boolean }) => {
    const newData = data.filter(d => d.id !== row.id);
    // Optimistic update
    setData(newData);
    await onChange(newData.map(d => ({ value: d.value, order: d.order, isSystem: d.isSystem })));
  };

  return (
    <InlineSettingsTable
      title={title}
      columns={columns}
      data={data}
      rowKey={(r) => r.id}
      onSave={handleSave}
      onDelete={handleDelete}
      canDelete={(row) => !row.isSystem}
      onAdd={() => ({ id: '', value: '', order: data.length > 0 ? Math.max(...data.map(d => d.order)) + 1 : 1, isSystem: false })}
      emptyLabel={emptyLabel}
    />
  );
}
