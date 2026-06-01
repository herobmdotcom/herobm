'use client';

import { useState } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';

interface LookupInputProps {
  value: string;
  onChange: (value: string) => void;
  provider: string;
  onEnrich: (data: any) => void;
  placeholder?: string;
  disabled?: boolean;
  onBlur?: () => void;
}

export default function LookupInput({
  value,
  onChange,
  provider,
  onEnrich,
  placeholder,
  disabled,
  onBlur,
}: LookupInputProps) {
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleLookup = async () => {
    if (!value.trim()) return;

    setIsLookingUp(true);
    try {
      const res = (await api.enrichmentControllerLookup({
        provider,
        query: value,
      })) as any;

      // Orval might return the data directly or wrap it in a data property depending on the client config
      const responseData = res.data ?? res;

      if (responseData && responseData.isValid) {
        onEnrich(responseData.data);
        toast.success('Data populated successfully');
      } else {
        toast.error('Invalid or not found');
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        className="input pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isLookingUp}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleLookup();
          }
        }}
      />
      <button
        type="button"
        className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center justify-center p-1"
        onClick={handleLookup}
        disabled={disabled || isLookingUp || !value.trim()}
        title="Lookup Data"
      >
        <span className={`material-symbols-outlined text-lg ${isLookingUp ? 'animate-spin' : ''}`}>
          {isLookingUp ? 'sync' : 'search'}
        </span>
      </button>
    </div>
  );
}
