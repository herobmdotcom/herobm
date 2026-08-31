'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';

export interface SearchResult {
  id: string;
  type:
    | 'product'
    | 'customer'
    | 'sales_order'
    | 'supplier'
    | 'purchase_order'
    | 'shipment'
    | 'goods_receipt'
    | 'sales_invoice'
    | 'purchase_invoice'
    | 'sales_return'
    | 'purchase_return'
    | 'sales_credit_note'
    | 'purchase_debit_note'
    | 'transfer_order'
    | 'work_order'
    | 'contact'
    | 'project'
    | 'payment';
  label: string;
  subtitle: string;
  href: string;
}

const TYPE_ORDER: SearchResult['type'][] = [
  'product',
  'customer',
  'sales_order',
  'supplier',
  'purchase_order',
  'shipment',
  'goods_receipt',
  'sales_invoice',
  'purchase_invoice',
  'sales_return',
  'purchase_return',
  'sales_credit_note',
  'purchase_debit_note',
  'transfer_order',
  'work_order',
  'contact',
  'project',
  'payment',
];

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  product: 'category',
  customer: 'storefront',
  sales_order: 'receipt_long',
  supplier: 'factory',
  purchase_order: 'local_shipping',
  shipment: 'local_post_office',
  goods_receipt: 'move_to_inbox',
  sales_invoice: 'request_quote',
  purchase_invoice: 'receipt',
  sales_return: 'assignment_return',
  purchase_return: 'assignment_return',
  sales_credit_note: 'credit_card',
  purchase_debit_note: 'price_check',
  transfer_order: 'sync_alt',
  work_order: 'build',
  contact: 'contacts',
  project: 'folder',
  payment: 'payments',
};

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

interface UniversalSearchProps {
  enabledEntities?: string[];
  onOpenSettings?: () => void;
}

export default function UniversalSearch({
  enabledEntities,
  onOpenSettings,
}: UniversalSearchProps) {
  const t = useTranslations('dashboard.search');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (rawTerm: string) => {
      const term = rawTerm.trim();
      if (!term || term.length < 2) {
        setResults([]);
        return;
      }
      try {
        const typesParam =
          enabledEntities && enabledEntities.length > 0
            ? enabledEntities.join(',')
            : undefined;
        const res = await api.dashboardControllerSearch({
          q: term,
          ...(typesParam ? { types: typesParam } : {}),
        } as unknown as Parameters<typeof api.dashboardControllerSearch>[0]);
        const searchData = res.data as { results?: SearchResult[] };
        setResults(searchData?.results || []);
      } catch {
        setResults([]);
      }
    },
    [enabledEntities],
  );

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
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

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
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[var(--text-muted)]">
            {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
            {'search'}
          </span>
          <input
            id="universal-search"
            className={`w-full pl-12 pr-4 py-3 rounded-full text-sm font-medium outline-none transition-all duration-150 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] ${
              showDropdown && results.length > 0 ? 'shadow-lg' : 'shadow-sm'
            }`}
            placeholder={t('placeholder')}
            value={query}
            onChange={(e) => {
              const val = e.target.value.trimStart();
              setQuery(val);
              setShowDropdown(true);
              setActiveIndex(-1);
              debouncedSearch(val);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            onBlur={(e) => setQuery(e.target.value.trim())}
            autoComplete="off"
          />
        </div>

        {onOpenSettings && (
          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group shrink-0 border border-[var(--border)] bg-[var(--bg-card)]"
            title={t('settings')}
          >
            <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">
              {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
              {'settings'}
            </span>
          </Button>
        )}
      </div>

      {showDropdown && query.length > 0 && (
        <div className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl">
          {query.length < 2 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
              {t('typeMinChars')}
            </div>
          ) : grouped.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
              {t('noResults')}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.type}>
                <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                  <span className="material-symbols-outlined text-[14px] text-[var(--accent)]">
                    {TYPE_ICONS[group.type]}
                  </span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl dynamic key */}
                  {t(`types.${group.type}` as any)}
                </div>
                {group.items.map((item) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors duration-100 ${
                        isActive ? 'bg-[var(--bg-secondary)]' : 'bg-transparent'
                      }`}
                      onMouseDown={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {item.label}
                        </span>
                        {item.subtitle && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <span
                        className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
                        {'arrow_forward'}
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
