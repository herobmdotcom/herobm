import { COUNTRIES } from '@/lib/countries';
import { useTranslations } from 'next-intl';

interface CountrySelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function CountrySelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: CountrySelectProps) {
  const t = useTranslations('common');

  return (
    <select
      className={`input ${className || ''}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
    >
      <option value="">{placeholder || t('selectNone')}</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
