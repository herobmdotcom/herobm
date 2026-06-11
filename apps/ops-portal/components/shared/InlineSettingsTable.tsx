import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface InlineTableColumn<T> {
  key: keyof T | string;
  title: string;
  type?: 'text' | 'textarea' | 'select' | 'boolean' | 'custom' | 'number' | 'password' | 'date';
  options?: { value: string; label: string }[] | ((row: Partial<T>) => { value: string; label: string }[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (row: T, isEditing: boolean, onChange?: (val: any) => void) => React.ReactNode;
  width?: string | number;
  disabled?: boolean; // if true, input is disabled during edit
  emptyLabel?: string | null; // override or hide the empty select option
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate?: (value: any, row: Partial<T>) => string | null;
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
  headerActions?: React.ReactNode;
  addLabel?: string;
  emptyLabel?: React.ReactNode;
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InlineSettingsTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  onSave,
  onDelete,
  onAdd,
  className,
  title,
  headerActions,
  addLabel,
  emptyLabel,
  canEdit,
  canDelete
}: InlineSettingsTableProps<T>) {
  const tSettings = useTranslations('admin.settings');
  const actualAddLabel = addLabel || tSettings('addRow');
  const tCommon = useTranslations('admin.common');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
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
    setErrors({});
  };

  const handleSave = async (rowId: string) => {
    const newErrors: Record<string, string> = {};
    for (const col of columns) {
      if (col.validate) {
        const error = col.validate(editForm[col.key as keyof T], editForm);
        if (error) newErrors[String(col.key)] = error;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    
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
          <div className="flex items-center gap-2">
            {headerActions}
            {onAdd && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleAdd}
                disabled={editingId !== null}
              >
                {actualAddLabel}
              </button>
            )}
          </div>
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
                {emptyLabel || tCommon('noRecordsFound')}
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
                      return (
                        <td key={String(col.key)}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {col.render(isEditing ? editForm as T : row, isEditing, (val: any) => {
                            setEditForm({ ...editForm, [col.key as keyof T]: val });
                            if (errors[String(col.key)]) setErrors(prev => ({ ...prev, [String(col.key)]: '' }));
                          })}
                        </td>
                      );
                    }
                    
                    const value = isEditing ? editForm[col.key as keyof T] : row[col.key as keyof T];
                    
                    return (
                      <td key={String(col.key)}>
                        {isEditing ? (
                          col.type === 'select' ? (
                            <div className="flex flex-col gap-1">
                              <select 
                                className={`input ${errors[String(col.key)] ? 'border-red-500' : ''}`} 
                                value={(value as string) || ''} 
                                onChange={e => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  setEditForm({ ...editForm, [col.key as keyof T]: e.target.value as any });
                                  if (errors[String(col.key)]) setErrors(prev => ({ ...prev, [String(col.key)]: '' }));
                                }}
                                disabled={col.disabled || saving}
                              >
                                {col.emptyLabel !== null && <option value="">{col.emptyLabel || '-'}</option>}
                                {(typeof col.options === 'function' ? col.options(editForm) : col.options)?.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              {errors[String(col.key)] && <span className="text-xs text-red-500">{errors[String(col.key)]}</span>}
                            </div>
                          ) : col.type === 'boolean' ? (
                            <label className="switch">
                              <input 
                                type="checkbox" 
                                checked={!!value} 
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onChange={e => setEditForm({ ...editForm, [col.key as keyof T]: e.target.checked as any })} 
                                disabled={col.disabled || saving}
                              />
                              <span className="switch-slider"></span>
                            </label>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <input 
                                type={col.type === 'number' || col.type === 'password' || col.type === 'date' ? col.type : 'text'}
                                className={`input w-full ${errors[String(col.key)] ? 'border-red-500' : ''}`} 
                                value={(value as string) || ''} 
                                onChange={e => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  setEditForm({ ...editForm, [col.key as keyof T]: e.target.value as any });
                                  if (errors[String(col.key)]) setErrors(prev => ({ ...prev, [String(col.key)]: '' }));
                                }}
                                disabled={col.disabled || saving}
                              />
                              {errors[String(col.key)] && <span className="text-xs text-red-500">{errors[String(col.key)]}</span>}
                            </div>
                          )
                        ) : (
                          col.type === 'select' ? (
                            <span>{(typeof col.options === 'function' ? col.options(row) : col.options)?.find(o => o.value === value)?.label || value}</span>
                          ) : col.type === 'boolean' ? (
                            <span style={{ color: value ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)', fontWeight: 'bold', fontSize: '0.75rem' }}>
                              {value ? tSettings('labels.active').toUpperCase() : tSettings('labels.inactive').toUpperCase()}
                            </span>
                          ) : (
                            <span>{value as React.ReactNode}</span>
                          )
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right whitespace-nowrap align-top pt-3">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-secondary btn-xs" onClick={handleCancel} disabled={saving}>
                          {tSettings('actions.cancel')}
                        </button>
                        <button className="btn btn-primary btn-xs" onClick={() => handleSave(id)} disabled={saving}>
                          {saving ? '...' : tSettings('actions.save')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {(!canEdit || canEdit(row)) && (
                          <button 
                            className="btn btn-secondary btn-xs" 
                            onClick={() => handleEdit(row)}
                            disabled={isProcessing || editingId !== null}
                          >
                            {tSettings('actions.edit')}
                          </button>
                        )}
                        {onDelete && (!canDelete || canDelete(row)) && (
                          <button 
                            className="btn btn-secondary btn-xs" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => handleDelete(row)}
                            disabled={isProcessing || editingId !== null}
                          >
                            {tSettings('actions.delete')}
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
