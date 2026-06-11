'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';

/**
 * ProductSearchInput — reusable product search with dropdown autocomplete.
 * Used by both the create and edit order screens for adding line items.
 *
 * Stock data (OH / Available) is fetched from the inventory endpoint,
 * which is the single source of truth for stock levels.
 */
interface Product {
  productId: string;
  productNumber: string;
  name: string;
  listPrice: string;
  tradePrice: string;
  standardCost?: string | null;
  baseUom?: string | null;
  productUoms?: unknown[];
  productGroupId?: string | null;
}



interface ProductSearchInputProps {
  /** Called when a product is selected from the dropdown */
  onSelect: (product: Product) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional inline style for the container */
  style?: React.CSSProperties;
  /** Optional fulfillment location to constrain stock search */
  fulfillmentLocationId?: string;
  /** Disable the input */
  disabled?: boolean;
}

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export type { Product };

export default function ProductSearchInput({
  onSelect,
  placeholder,
  style,
  fulfillmentLocationId,
  disabled,
}: ProductSearchInputProps) {
  const t = useTranslations('common.productSearch');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchProducts = useCallback(async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || term.length < 2) { setResults([]); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.productsControllerFindAll({ q: term, limit: 10 } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResults(((res.data as any)?.data || res.data || []) );
    } catch { setResults([]); }
  }, []);

  const debouncedSearch = useDebounce(
    (term: unknown) => searchProducts(term as string), 300,
  );

  const handleSelect = async (p: Product) => {
    setShowDropdown(false);
    setSearch('');
    setResults([]);
    try {
      // Fetch full details (including productUoms) from findOne before yielding
      const res = await api.productsControllerFindOne(p.productId);
      const data = res.data;
      if (data) {
        onSelect(data as unknown as Product);
      } else {
        onSelect(p);
      }
    } catch {
      // Fallback to the shallow object if the detail fetch fails
      onSelect(p);
    }
  };

  return (
    <div className="relative" style={style}>
      <input
        className="input"
        style={{ width: '100%' }}
        placeholder={placeholder || t('placeholder')}
        disabled={disabled}
        value={search}
        onChange={(e) => {
          const val = e.target.value.trimStart();
          setSearch(val);
          setShowDropdown(true);
          debouncedSearch(val);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={(e) => {
          setSearch(e.target.value.trim());
          setTimeout(() => setShowDropdown(false), 200);
        }}
      />
      {showDropdown && search && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {(Array.isArray(results) ? results : []).map((p) => {
            return (
            <div
              key={p.productId}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
              onMouseDown={() => handleSelect(p)}
            >
              <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {p.productNumber}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 13 }}>
                    {p.name}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {search.length < 2 ? t('typeMinChars') : t('noMatchingProducts')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
