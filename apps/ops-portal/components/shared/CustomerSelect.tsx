'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';

export interface Customer {
  customerId: string;
  customerNumber: string;
  name: string;
  currencyCode?: string;
  customerGroupId?: string | null;
  customerDiscount?: string | null;
  taxPosition?: string | null;
}

interface AccountSelectProps {
  value: string | null;
  onChange: (customer: Customer | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
  excludeId?: string | null;
}

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function CustomerSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
  excludeId,
}: AccountSelectProps) {
  const t = useTranslations('common');
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredAccounts, setFilteredAccounts] = useState<Customer[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      setSearchTerm('');
    } else if (initialSearchTerm && !searchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [value, initialSearchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAccounts = useCallback(async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || term.length < 2) { 
      setFilteredAccounts([]); 
      return; 
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.accountsControllerFindAll({ q: term, limit: 10 } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataArray = (res.data as any)?.data || res.data || [];
      if (excludeId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFilteredAccounts(dataArray.filter((c: any) => c.customerId !== excludeId));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFilteredAccounts(dataArray as any);
      }
    } catch { 
      setFilteredAccounts([]); 
    }
  }, [excludeId]);

  const debouncedSearch = useDebounce((term: string) => searchAccounts(term), 300);

  const handleSelect = (acc: Customer) => {
    setSearchTerm(`${acc.customerNumber} — ${acc.name}`);
    setShowDropdown(false);
    onChange(acc);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    onChange(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          className={`input ${className || ''}`}
          autoComplete="off"
          placeholder={placeholder || t('selectEllipsis')}
          value={searchTerm}
          disabled={disabled}
          required={required && !value}
          onChange={(e) => {
            const val = e.target.value.trimStart();
            setSearchTerm(val);
            setShowDropdown(true);
            if (value) onChange(null);
            debouncedSearch(val);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={(e) => setSearchTerm(e.target.value.trim())}
        />
        {searchTerm && !disabled && (
          <button
            type="button"
            className="absolute right-3 text-xs cursor-pointer text-gray-400 hover:text-gray-600"
            onClick={handleClear}
          >
            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
          </button>
        )}
      </div>

      {showDropdown && searchTerm && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {(Array.isArray(filteredAccounts) ? filteredAccounts : []).slice(0, 10).map((a) => (
            <div
              key={a.customerId}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(a);
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {a.customerNumber}
              </span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                {a.name}
              </span>
            </div>
          ))}
          {filteredAccounts.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('noMatchingResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
