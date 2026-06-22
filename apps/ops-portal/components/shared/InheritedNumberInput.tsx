import React from 'react';

export interface InheritedNumberInputProps {
  value?: string | number | null;
  onChange: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  inheritedValue?: string | number | null;
  inheritedSourceLabel?: string | null;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}

export default function InheritedNumberInput({
  value,
  onChange,
  onBlur,
  inheritedValue,
  inheritedSourceLabel,
  disabled,
  className = 'input',
  placeholder,
  min,
  max,
  step,
}: InheritedNumberInputProps) {
  const hasLocalValue = value !== undefined && value !== null && value !== '';
  const hasInherited = inheritedValue !== undefined && inheritedValue !== null && inheritedValue !== '' && !!inheritedSourceLabel;

  return (
    <div className="flex-1 min-w-0 w-full relative group">
      <input
        type="number"
        className={`${className} w-full`}
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        title={hasInherited && !hasLocalValue ? `Inherited from ${inheritedSourceLabel}: ${inheritedValue}` : undefined}
      />
    </div>
  );
}
