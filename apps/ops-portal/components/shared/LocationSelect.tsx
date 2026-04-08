import { useState, useEffect } from 'react';
import { apiFetch, reportError } from '@/lib/api';

interface Location {
  locationId: string;
  code: string;
  name: string;
}

interface LocationSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export default function LocationSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
}: LocationSelectProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    apiFetch<{ data: Location[] }>('/api/inventory/locations')
      .then((response) => {
        if (active) setLocations(response.data);
      })
      .catch((err) => reportError(err, 'LocationSelect'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <select
      className={`input ${className || ''}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled || loading}
      required={required}
    >
      <option value="" disabled={required}>
        {loading ? 'Loading...' : placeholder || 'Choose Location'}
      </option>
      {locations.map((loc) => (
        <option key={loc.locationId} value={loc.locationId}>
          {loc.code} — {loc.name}
        </option>
      ))}
    </select>
  );
}
