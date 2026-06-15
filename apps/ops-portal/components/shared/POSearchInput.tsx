'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';

interface PurchaseOrder {
  purchaseOrderId: string;
  orderNumber: string;
  vendorName?: string;
  totalAmount: string;
  currencyCode: string;
}

interface POSearchInputProps {
  vendorId?: string;
  onSelect: (poId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function POSearchInput({
  vendorId,
  onSelect,
  placeholder = 'Search Purchase Orders...',
  style,
  disabled = false,
}: POSearchInputProps) {
  const t = useTranslations('purchaseOrders');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PurchaseOrder[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const inputRef = useRef<HTMLInputElement>(null);

  const searchPOs = useCallback(async (term: string, vId?: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.purchaseOrdersControllerFindAll({ search: term || undefined, vendorId: vId, limit: 20 } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults(((res.data as any)?.data || res.data || []));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce((term: string, vId?: string) => searchPOs(term, vId), 300);

  useEffect(() => {
    debouncedSearch(search, vendorId);
  }, [search, vendorId, debouncedSearch]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
      });
    }
  };

  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [showDropdown]);

  const handleSearch = (term: string) => {
    setSearch(term);
    setShowDropdown(true);
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <input
        ref={inputRef}
        type="text"
        className="input"
        placeholder={placeholder}
        value={search}
        onChange={(e) => handleSearch(e.target.value.trimStart())}
        onFocus={() => setShowDropdown(true)}
        onBlur={(e) => {
          setSearch(e.target.value.trim());
        }}
        style={{ width: '100%', fontSize: 13, padding: '4px 8px' }}
      />
      
      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99,
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div
            className="dropdown-menu shadow"
            style={{
              position: 'fixed',
              ...dropdownStyle,
              zIndex: 100,
              maxHeight: 250,
              overflowY: 'auto',
              backgroundColor: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            {loading && results.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                Searching...
              </div>
            ) : results.length > 0 ? (
              (Array.isArray(results) ? results : []).map((po) => (
                <button
                  key={po.purchaseOrderId}
                  className="dropdown-item flex items-center justify-between w-full"
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-light)',
                    textAlign: 'left',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                  }}
                  onClick={() => {
                    setSearch('');
                    setShowDropdown(false);
                    onSelect(po.purchaseOrderId);
                  }}
                >
                  <div className="flex flex-col">
                    <span style={{ fontWeight: 600 }}>{po.orderNumber}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {po.vendorName}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(po.totalAmount).toFixed(2)} {po.currencyCode}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                {t('noPosFound')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
