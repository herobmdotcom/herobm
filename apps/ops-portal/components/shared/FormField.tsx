import React from 'react';
import { useTranslations } from 'next-intl';

export interface FormFieldProps {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'date' | 'textarea';
  title: string;
  value: unknown;
  onChange: (val: unknown) => void;
  onBlur?: (val: unknown) => void;
  required?: boolean;
  readOnly?: boolean;
  options?: string[]; // For enum
  description?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  type,
  title,
  value,
  onChange,
  onBlur,
  required,
  readOnly,
  options,
  description,
}) => {
  const t = useTranslations('common');
  if (type === 'boolean') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <div className="pt-0.5">
          <label className="switch" title={title}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => {
                onChange(e.target.checked);
                onBlur?.(e.target.checked);
              }}
              disabled={readOnly}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>
    );
  }

  if (type === 'date') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <input
          type="date"
          className="input w-full"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          disabled={readOnly}
        />
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <textarea
          className="input w-full min-h-[80px] p-2"
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur?.(e.target.value)}
          disabled={readOnly}
          placeholder={description || ''}
        />
      </div>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <input
          type="number"
          className="input w-full"
          value={(value as string | number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={(e) => onBlur?.(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={readOnly}
          placeholder={description || ''}
        />
      </div>
    );
  }

  if (type === 'enum' || (options && options.length > 0)) {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <select
          className="input w-full"
          value={(value as string | number) ?? ''}
          onChange={(e) => {
            onChange(e.target.value);
            onBlur?.(e.target.value);
          }}
          disabled={readOnly}
        >
          <option value="">{t('selectOption')}</option>
          {(options || []).map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Default to string
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
        {title} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      <input
        type="text"
        className="input w-full"
        value={(value as string | number) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        disabled={readOnly}
        placeholder={description || ''}
      />
    </div>
  );
};
