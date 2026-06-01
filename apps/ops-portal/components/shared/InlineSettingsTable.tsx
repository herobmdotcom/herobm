import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface InlineTableColumn<T> {
  key: keyof T | string;
  title: string;
  type?: 'text' | 'select' | 'boolean' | 'custom';
  options?: { value: string; label: string }[] | ((row: Partial<T>) => { value: string; label: string }[]);
  render?: (row: T, isEditing: boolean) => React.ReactNode;
  width?: string | number;
  disabled?: boolean; // if true, input is disabled during edit
}

export interface InlineSettingsTableProps<T> {
  columns: InlineTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onSave: (row: T, isNew: boolean) => Promise<void>;
  onDelete?: (row: T) => Promise<void>;
  onAdd?: () => T; // returns a new empty row
  className?: string;
  title?: React.ReactNode;
  addLabel?: string;
}

export function InlineSettingsTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  onSave,
  onDelete,
  onAdd,
  className,
  title,
  addLabel = 'Add Row'
}: InlineSettingsTableProps<T>) {
  const tSettings = useTranslations('admin.settings');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  
  // Also track rows being processed
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleEdit = (row: T) => {
    setEditingId(rowKey(row));
    setEditForm({ ...row });
    setIsNew(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setIsNew(false);
  };

  const handleSave = async (rowId: string) => {
    try {
      setSaving(true);
      setProcessingId(rowId);
      await onSave(editForm as T, isNew);
      setEditingId(null);
      setEditForm({});
      setIsNew(false);
    } catch (e) {
      // Error is usually handled by parent (e.g. toast), but we release the state
    } finally {
      setSaving(false);
      setProcessingId(null);
    }
  };

  const handleDelete = async (row: T) => {
    if (!onDelete) return;
    const id = rowKey(row);
    try {
      setProcessingId(id);
      await onDelete(row);
    } catch (e) {
      // Handle error
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdd = () => {
    if (!onAdd) return;
    const newRow = onAdd();
    const tempId = 'NEW_ROW'; // Special ID for new row
    setEditingId(tempId);
    setEditForm({ ...newRow });
    setIsNew(true);
  };

  // Combine real data and potential new row
  const renderData = [...data];
  if (isNew && editingId === 'NEW_ROW') {
    renderData.push(editForm as T);
  }

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      {(title || onAdd) && (
        <div className="flex items-center justify-between mb-1">
          {title ? (
            typeof title === 'string' ? <h4 className="font-bold text-sm !mb-0">{title}</h4> : title
          ) : <div />}
          {onAdd && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleAdd}
              disabled={editingId !== null}
            >
              + {addLabel}
            </button>
          )}
        </div>
      )}
      <table className="table-lines w-full text-sm">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.key)} style={{ width: col.width }}>{col.title}</th>
            ))}
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {renderData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="text-center py-8 text-muted">
                No records found.
              </td>
            </tr>
          ) : (
            renderData.map((row) => {
              const id = isNew && row === editForm ? 'NEW_ROW' : rowKey(row);
              const isEditing = editingId === id;
              const isProcessing = processingId === id;
              
              return (
                <tr key={id} style={isEditing ? { background: 'var(--bg-secondary)' } : undefined}>
                  {columns.map(col => {
                    if (col.render) {
                      return <td key={String(col.key)}>{col.render(isEditing ? editForm as T : row, isEditing)}</td>;
                    }
                    
                    const value = isEditing ? editForm[col.key as keyof T] : row[col.key as keyof T];
                    
                    return (
                      <td key={String(col.key)}>
                        {isEditing ? (
                          col.type === 'select' ? (
                            <select 
                              className="input" 
                              value={(value as string) || ''} 
                              onChange={e => setEditForm({ ...editForm, [col.key as keyof T]: e.target.value as any })}
                              disabled={col.disabled || saving}
                            >
                              <option value="">-</option>
                              {(typeof col.options === 'function' ? col.options(editForm) : col.options)?.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : col.type === 'boolean' ? (
                            <label className="switch">
                              <input 
                                type="checkbox" 
                                checked={!!value} 
                                onChange={e => setEditForm({ ...editForm, [col.key as keyof T]: e.target.checked as any })} 
                                disabled={col.disabled || saving}
                              />
                              <span className="switch-slider"></span>
                            </label>
                          ) : (
                            <input 
                              className="input w-full" 
                              value={(value as string) || ''} 
                              onChange={e => setEditForm({ ...editForm, [col.key as keyof T]: e.target.value as any })}
                              disabled={col.disabled || saving}
                            />
                          )
                        ) : (
                          col.type === 'select' ? (
                            <span>{(typeof col.options === 'function' ? col.options(row) : col.options)?.find(o => o.value === value)?.label || value}</span>
                          ) : col.type === 'boolean' ? (
                            <span style={{ color: value ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', fontWeight: 'bold', fontSize: '0.75rem' }}>
                              {value ? (tSettings('labels.active') || 'Active').toUpperCase() : (tSettings('labels.inactive') || 'Inactive').toUpperCase()}
                            </span>
                          ) : (
                            <span>{value as React.ReactNode}</span>
                          )
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-secondary btn-xs" onClick={handleCancel} disabled={saving}>
                          {tSettings('actions.cancel') || 'Cancel'}
                        </button>
                        <button className="btn btn-primary btn-xs" onClick={() => handleSave(id)} disabled={saving}>
                          {saving ? '...' : (tSettings('actions.save') || 'Save')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button 
                          className="btn btn-secondary btn-xs" 
                          onClick={() => handleEdit(row)}
                          disabled={isProcessing || editingId !== null}
                        >
                          {tSettings('actions.edit') || 'Edit'}
                        </button>
                        {onDelete && (
                          <button 
                            className="btn btn-secondary btn-xs" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => handleDelete(row)}
                            disabled={isProcessing || editingId !== null}
                          >
                            {tSettings('actions.delete') || 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
