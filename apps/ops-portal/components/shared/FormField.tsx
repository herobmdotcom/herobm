import React from 'react';
import { useTranslations } from 'next-intl';

export interface FormFieldProps {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'enum';
  title: string;
  value: unknown;
  onChange: (val: unknown) => void;
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
  required,
  readOnly,
  options,
  description,
}) => {
  const t = useTranslations('common');
  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-muted w-48 shrink-0">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <label className="switch" title={title}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
          />
          <span className="switch-slider"></span>
        </label>
      </div>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-muted w-48 shrink-0">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <input
          type="number"
          className="input flex-1"
          value={(value as string | number) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={readOnly}
          placeholder={description || ''}
        />
      </div>
    );
  }

  if (type === 'enum' || (options && options.length > 0)) {
    return (
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-muted w-48 shrink-0">
          {title} {required && <span className="text-[var(--danger)]">*</span>}
        </label>
        <select
          className="input flex-1"
          value={(value as string | number) ?? ''}
          onChange={(e) => onChange(e.target.value)}
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
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium text-muted w-48 shrink-0">
        {title} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      <input
        type="text"
        className="input flex-1"
        value={(value as string | number) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        placeholder={description || ''}
      />
    </div>
  );
};
