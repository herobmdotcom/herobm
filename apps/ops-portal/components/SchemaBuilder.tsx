import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from './shared/FormField';

export interface SchemaBuilderProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}

type FieldType = 'string' | 'number' | 'boolean' | 'enum';

interface FieldDef {
  id: string; // internal id for React key mapping
  key: string;
  title: string;
  type: FieldType;
  options?: string; // Comma separated list for enums
  required: boolean;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({ value, onChange }) => {
  const t = useTranslations('schemaBuilder');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<FieldDef | null>(null);
  const lastEmittedSchema = React.useRef<Record<string, unknown>>(value);

  // Parse incoming JSON schema on mount or when value changes externally
  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(lastEmittedSchema.current) && fields.length > 0) {
      // If the incoming value is structurally identical to what we just emitted,
      // don't rebuild the internal fields array. This prevents loss of focus/stable IDs
      // and preserves "in-progress" fields that haven't been emitted yet (e.g. empty keys).
      return;
    }

    if (!value || typeof value !== 'object' || value.type !== 'object') {
      setFields([]);
      return;
    }

    const properties = value.properties || {};
    const requiredList = Array.isArray(value.required) ? value.required : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const newFields: FieldDef[] = Object.entries(properties).map(([k, schema]: [string, any]) => {
      let type: FieldDef['type'] = 'string';
      if (schema.enum) type = 'enum';
      else if (schema.type === 'number' || schema.type === 'integer') type = 'number';
      else if (schema.type === 'boolean') type = 'boolean';

      return {
        id: Math.random().toString(36).substring(2, 9),
        key: k,
        title: schema.title || k,
        type,
        options: schema.enum ? schema.enum.join(', ') : '',
        required: requiredList.includes(k),
      };
    });

    setFields(newFields);
    lastEmittedSchema.current = value;
  }, [value]);

  const updateSchema = (newFields: FieldDef[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const properties: Record<string, any> = {};
    const required: string[] = [];

    newFields.forEach(f => {
      // Ignore fields with no key
      if (!f.key.trim()) return;

      const key = f.key.trim();
      if (f.required) required.push(key);

      properties[key] = {
        title: f.title.trim(),
        type: f.type === 'enum' ? 'string' : f.type,
      };

      if (f.type === 'enum') {
        properties[key].enum = f.options ? f.options.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
    });

    const newSchema = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
    
    lastEmittedSchema.current = newSchema;
    onChange(newSchema);
  };

  const handleAddField = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newField: FieldDef = {
      id: newId,
      key: '',
      title: 'New Field',
      type: 'string',
      required: false,
    };
    const newFields = [...fields, newField];
    setFields(newFields);
    setEditingFieldId(newId);
    setEditingSnapshot(newField);
    // Note: Don't instantly update schema if key is empty, updateSchema ignores empty keys
    updateSchema(newFields);
  };

  const handleCancel = () => {
    if (editingSnapshot) {
      if (editingSnapshot.key === '' && editingSnapshot.title === 'New Field') {
        // It was a newly added field, remove it
        const newFields = fields.filter(f => f.id !== editingFieldId);
        setFields(newFields);
        updateSchema(newFields);
      } else {
        // Restore snapshot
        const newFields = fields.map(f => f.id === editingFieldId ? editingSnapshot : f);
        setFields(newFields);
        updateSchema(newFields);
      }
    }
    setEditingFieldId(null);
    setEditingSnapshot(null);
  };

  const handleRemoveField = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newFields = fields.filter(f => f.id !== id);
    setFields(newFields);
    if (editingFieldId === id) {
      setEditingFieldId(null);
      setEditingSnapshot(null);
    }
    updateSchema(newFields);
  };

  const handleChange = (id: string, updates: Partial<FieldDef>) => {
    const newFields = fields.map(f => {
      if (f.id === id) {
        const updated = { ...f, ...updates };
        // Auto-generate key from title if key is empty and we're editing title
        if (updates.title !== undefined && !f.key) {
          updated.key = updates.title
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .split(' ')
            .map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
        }
        return updated;
      }
      return f;
    });
    setFields(newFields);
    updateSchema(newFields);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end mb-2">
        <button className="btn btn-secondary btn-sm" onClick={handleAddField}>
          {t('addField')}
        </button>
      </div>
      
      {fields.length === 0 ? (
        <div className="text-center py-8 text-muted bg-[var(--bg-card)] rounded border border-dashed border-[var(--border)]">{t('noFields')}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map(field => {
            const isEditing = editingFieldId === field.id;

            if (isEditing) {
              return (
                <div key={field.id} className="card bg-[var(--bg-primary)] border border-[var(--border)] p-4 -mx-4 flex flex-col gap-4 relative">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{t('editFieldTitle', { title: field.title || t('newField') })}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">{t('fieldTitle')}</label>
                      <input 
                        type="text" 
                        className="input w-full" 
                        placeholder="e.g. BSB Number"
                        value={field.title} 
                        onChange={e => handleChange(field.id, { title: e.target.value })} 
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">{t('internalKey')}</label>
                      <input 
                        type="text" 
                        className="input w-full font-mono text-xs" 
                        placeholder="e.g. bsbNumber"
                        value={field.key} 
                        onChange={e => handleChange(field.id, { key: e.target.value })} 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">{t('dataType')}</label>
                      <select 
                        className="input w-full" 
                        value={field.type} 
                        onChange={e => handleChange(field.id, { type: e.target.value as FieldType })}
                      >
                        <option value="string">{t('types.string')}</option>
                        <option value="number">{t('types.number')}</option>
                        <option value="boolean">{t('types.boolean')}</option>
                        <option value="enum">{t('types.enum')}</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 justify-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input 
                          type="checkbox" 
                          className="mr-1"
                          checked={field.required}
                          onChange={e => handleChange(field.id, { required: e.target.checked })}
                        />
                        <span className="text-sm font-medium">{t('requiredField')}</span>
                      </label>
                    </div>

                    {field.type === 'enum' && (
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted">{t('dropdownOptions')}</label>
                        <input 
                          type="text" 
                          className="input w-full" 
                          placeholder="e.g. Option A, Option B, Option C"
                          value={field.options} 
                          onChange={e => handleChange(field.id, { options: e.target.value })} 
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button className="btn btn-secondary btn-sm" onClick={handleCancel}>{t('cancel')}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingFieldId(null); setEditingSnapshot(null); }}>{t('save')}</button>
                  </div>
                </div>
              );
            }

            // Preview Mode
            return (
              <div 
                key={field.id} 
                className="group relative border border-transparent hover:border-[var(--border)] hover:bg-gray-50/50 p-3 -mx-3 rounded cursor-pointer transition-colors flex items-center"
                onClick={() => { setEditingSnapshot(field); setEditingFieldId(field.id); }}
              >
                <div className="flex-1 pointer-events-none">
                  <FormField
                    type={field.type}
                    title={field.title || t('untitledField')}
                    value={field.type === 'boolean' ? false : ''}
                    onChange={() => {}}
                    required={field.required}
                    options={field.options ? field.options.split(',').map(s => s.trim()).filter(Boolean) : []}
                  />
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto">
                  <button 
                    className="btn btn-sm btn-ghost text-muted hover:text-gray-800 h-8 w-8 p-0 flex items-center justify-center rounded-full bg-white border border-gray-200"
                    title={t('editField')}
                    onClick={(e) => { e.stopPropagation(); setEditingSnapshot(field); setEditingFieldId(field.id); }}
                  >
                    { }
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button 
                    className="btn btn-sm btn-ghost text-[var(--danger)] hover:bg-red-50 h-8 w-8 p-0 flex items-center justify-center rounded-full bg-white border border-gray-200"
                    title={t('removeField')}
                    onClick={(e) => handleRemoveField(field.id, e)}
                  >
                    { }
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
