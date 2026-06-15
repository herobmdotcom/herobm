import { useState, useRef, useCallback, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';

export interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  currencyCode?: string;
}

interface SupplierSelectProps {
  value: string | null;
  onChange: (supplier: Supplier | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  initialSearchTerm?: string;
}

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function SupplierSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  required,
  initialSearchTerm,
}: SupplierSelectProps) {
  const t = useTranslations('common');
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize searchTerm if a supplier is already selected but searchTerm is empty.
  // We'll need to fetch the supplier name if we only have the ID, but for our current use cases
  // (new PO, new receiving), the value starts as null.
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

  const searchSuppliers = useCallback(async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || term.length < 2) { 
      setFilteredSuppliers([]); 
      return; 
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.suppliersControllerFindAll({ q: term, limit: 10 } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFilteredSuppliers(((res.data as any)?.data || res.data || []) );
    } catch { 
      setFilteredSuppliers([]); 
    }
  }, []);

  const debouncedSearch = useDebounce((term: string) => searchSuppliers(term), 300);

  const handleSelect = (sup: Supplier) => {
    setSearchTerm(`${sup.vendorNumber} — ${sup.name}`);
    setShowDropdown(false);
    onChange(sup);
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
          {(Array.isArray(filteredSuppliers) ? filteredSuppliers : []).slice(0, 10).map((s) => (
            <div
              key={s.vendorId}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                handleSelect(s);
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {s.vendorNumber}
              </span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                {s.name}
              </span>
            </div>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('noMatchingResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
