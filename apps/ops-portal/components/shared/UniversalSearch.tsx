'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../lib/api';

interface SearchResult {
  id: string;
  type: 'product' | 'account' | 'sales_order' | 'supplier' | 'purchase_order';
  label: string;
  subtitle: string;
  href: string;
}

const TYPE_ORDER: SearchResult['type'][] = [
  'product',
  'account',
  'sales_order',
  'supplier',
  'purchase_order',
];

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  product: 'category',
  account: 'storefront',
  sales_order: 'receipt_long',
  supplier: 'factory',
  purchase_order: 'local_shipping',
};

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function UniversalSearch() {
  const t = useTranslations('dashboard.search');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    try {
      const data = await apiFetch<{ results: SearchResult[] }>(
        `/api/dashboard/search?q=${encodeURIComponent(term)}`,
      );
      setResults(data.results);
    } catch {
      setResults([]);
    }
  }, []);

  const debouncedSearch = useDebounce(
    (term: unknown) => search(term as string),
    300,
  );

  const navigate = (result: SearchResult) => {
    setShowDropdown(false);
    setQuery('');
    setResults([]);
    router.push(result.href);
  };

  // Group results by type for rendering
  const grouped = TYPE_ORDER
    .map((type) => ({
      type,
      items: results.filter((r) => r.type === type),
    }))
    .filter((g) => g.items.length > 0);

  // Flat list for keyboard nav
  const flatResults = grouped.flatMap((g) => g.items);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || flatResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      navigate(flatResults[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mb-8">
      <div className="relative">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span
          className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px]"
          style={{ color: 'var(--text-muted)' }}
        >
          search
        </span>
        <input
          id="universal-search"
          className="w-full pl-12 pr-4 py-3 rounded-full text-sm font-medium outline-none transition-all duration-150"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            boxShadow: showDropdown && results.length > 0
              ? '0 8px 32px rgba(0,0,0,0.12)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }}
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
            debouncedSearch(e.target.value);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      {showDropdown && query.length > 0 && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}
        >
          {query.length < 2 ? (
            <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('typeMinChars')}
            </div>
          ) : grouped.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('noResults')}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.type}>
                <div
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ color: 'var(--accent)' }}
                  >
                    {TYPE_ICONS[group.type]}
                  </span>
                  {t(`types.${group.type}`)}
                </div>
                {group.items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors duration-100"
                      style={{
                        background: isActive ? 'var(--bg-secondary)' : 'transparent',
                      }}
                      onMouseDown={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="flex-1 min-w-0">
                        <span
                          className="font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.label}
                        </span>
                        {item.subtitle && (
                          <span
                            className="ml-2 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      <span
                        className="material-symbols-outlined text-[16px]"
                        style={{ color: 'var(--text-muted)', opacity: isActive ? 1 : 0 }}
                      >
                        arrow_forward
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
