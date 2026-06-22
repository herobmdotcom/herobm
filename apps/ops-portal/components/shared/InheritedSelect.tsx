import React from 'react';
import { useTranslations } from 'next-intl';

export interface InheritedSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  inheritedValue?: string | number | null;
  inheritedSourceLabel?: string | null;
  disabled?: boolean;
  className?: string;
}

export default function InheritedSelect({
  value,
  onChange,
  options,
  inheritedValue,
  inheritedSourceLabel,
  disabled,
  className = 'input',
}: InheritedSelectProps) {
  const t = useTranslations('common');

  // Find the label of the inherited value
  const inheritedOption = options.find((opt) => opt.value === inheritedValue);
  const resolvedLabel = inheritedOption ? inheritedOption.label : '';

  const hasInherited = !!inheritedValue && !!inheritedSourceLabel;

  return (
    <select
      className={className}
      disabled={disabled}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {hasInherited ? (
        <option value="" className="italic text-muted">
          {t('options.inheritValue', { label: resolvedLabel, source: inheritedSourceLabel })}
        </option>
      ) : (
        <option value="">{t('options.none')}</option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
