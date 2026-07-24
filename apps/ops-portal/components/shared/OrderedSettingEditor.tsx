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
  const [data, setData] = useState<{ id: string; value: string; order: number }[]>([]);

  useEffect(() => {
    setData(
      (items || [])
        .map((val, i) => ({ id: `id-${i}-${val.value}`, value: val.value, order: val.order }))
        .sort((a, b) => a.order - b.order)
    );
  }, [items]);

  const columns: InlineTableColumn<{ id: string; value: string; order: number }>[] = [
    { key: 'order', title: 'Order', type: 'number' },
    { key: 'value', title: columnTitle || 'Value', type: 'text' }
  ];

  const handleSave = async (row: { id: string; value: string; order: number }, isNew: boolean) => {
    if (!row.value) return;
    const newData = [...data];
    if (isNew) {
      newData.push({ id: `id-${newData.length}-${crypto.randomUUID()}`, value: row.value, order: Number(row.order) });
    } else {
      const idx = newData.findIndex(d => d.id === row.id);
      if (idx !== -1) {
        newData[idx].value = row.value;
        newData[idx].order = Number(row.order);
      }
    }
    
    newData.sort((a, b) => a.order - b.order);

    // Optimistic update
    setData(newData);
    await onChange(newData.map(d => ({ value: d.value, order: d.order })));
  };

  const handleDelete = async (row: { id: string; value: string; order: number }) => {
    const newData = data.filter(d => d.id !== row.id);
    // Optimistic update
    setData(newData);
    await onChange(newData.map(d => ({ value: d.value, order: d.order })));
  };

  return (
    <InlineSettingsTable
      title={title}
      columns={columns}
      data={data}
      rowKey={(r) => r.id}
      onSave={handleSave}
      onDelete={handleDelete}
      onAdd={() => ({ id: '', value: '', order: data.length > 0 ? Math.max(...data.map(d => d.order)) + 1 : 1 })}
      emptyLabel={emptyLabel}
    />
  );
}
