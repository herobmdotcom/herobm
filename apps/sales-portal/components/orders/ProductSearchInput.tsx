'use client';

import { useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';

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
}

interface InventoryLevel {
  productId: string;
  quantityOnHand: string;
  quantityAvailable: string;
}

/** Aggregated stock for display in the dropdown */
interface ProductStock {
  onHand: number;
  available: number;
}

interface ProductSearchInputProps {
  /** Called when a product is selected from the dropdown */
  onSelect: (product: Product) => void;
  /** Optional placeholder text */
  placeholder?: string;
  /** Optional inline style for the container */
  style?: React.CSSProperties;
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
  placeholder = 'Search product…',
  style,
}: ProductSearchInputProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, ProductStock>>({});
  const [showDropdown, setShowDropdown] = useState(false);

  const searchProducts = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setResults([]); setStockMap({}); return; }
    try {
      const data = await apiFetch<{ data: Product[] }>(
        `/api/products?search=${encodeURIComponent(term)}&limit=10`,
      );
      setResults(data.data);

      // Fetch stock from inventory for these products
      const ids = data.data.map((p) => p.productId).filter(Boolean);
      if (ids.length > 0) {
        try {
          const inv = await apiFetch<{ data: InventoryLevel[] }>(
            `/api/inventory/by-products?productIds=${ids.join(',')}`,
          );
          // Aggregate per product (sum across locations)
          const map: Record<string, ProductStock> = {};
          for (const row of inv.data) {
            if (!map[row.productId]) map[row.productId] = { onHand: 0, available: 0 };
            map[row.productId].onHand += parseFloat(row.quantityOnHand || '0');
            map[row.productId].available += parseFloat(row.quantityAvailable || '0');
          }
          setStockMap(map);
        } catch {
          setStockMap({});
        }
      }
    } catch { setResults([]); setStockMap({}); }
  }, []);

  const debouncedSearch = useDebounce(
    (term: unknown) => searchProducts(term as string), 300,
  );

  const handleSelect = (p: Product) => {
    setShowDropdown(false);
    setSearch('');
    setResults([]);
    setStockMap({});
    onSelect(p);
  };

  return (
    <div className="relative" style={style}>
      <input
        className="input"
        style={{ width: '100%', fontSize: 13 }}
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowDropdown(true);
          debouncedSearch(e.target.value);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
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
          {results.map((p) => {
            const stock = stockMap[p.productId];
            const onHand = stock?.onHand ?? 0;
            const avail = stock?.available ?? 0;
            return (
            <div
              key={p.productId}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
              onMouseDown={() => handleSelect(p)}
            >
              <div className="flex items-center justify-between">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {p.productNumber}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {p.name}
                  </span>
                </div>
                <div className="flex gap-2 ml-3" style={{ flexShrink: 0, fontSize: 11 }}>
                  <span style={{
                    color: onHand > 0 ? '#4ade80' : '#f59e0b',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    OH: {onHand}
                  </span>
                  <span style={{
                    color: avail > 0 ? '#4ade80' : '#ef4444',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    Avail: {avail}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {search.length < 2 ? 'Type at least 2 characters…' : 'No matching products'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
