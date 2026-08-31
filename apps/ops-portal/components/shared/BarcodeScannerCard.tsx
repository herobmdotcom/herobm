'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import InlineAlert from './InlineAlert';
import { useTranslations } from 'next-intl';

export interface BarcodeScannerSearchResult<T = unknown> {
  id: string;
  primaryText: string;
  secondaryText?: string;
  extraText?: string;
  data: T;
}

export interface BarcodeScannerFeedback {
  type: 'success' | 'error' | 'info' | 'warning';
  message: React.ReactNode;
  detail?: React.ReactNode;
}

export interface BarcodeScannerCardProps<T = unknown> {
  /** Label next to status indicator (defaults to "Scanner Active") */
  label?: React.ReactNode;
  /** Input placeholder */
  placeholder?: string;
  /** Value of the barcode input if controlled externally */
  value?: string;
  /** Handler when input value changes */
  onChangeValue?: (val: string) => void;
  /** Whether an async scan/submit operation is in flight */
  isProcessing?: boolean;
  /** Feedback alert message/detail to display beneath input */
  feedback?: BarcodeScannerFeedback | null;
  /** Invoked on direct barcode Enter/Submit */
  onScan: (barcode: string) => void | Promise<void>;
  /** Optional search handler for live search-select mode as the user types */
  onSearch?: (query: string) => Promise<BarcodeScannerSearchResult<T>[]>;
  /** Invoked when user selects a search result item from dropdown */
  onSelectResult?: (item: BarcodeScannerSearchResult<T>) => void | Promise<void>;
  /** Custom render for search result item */
  renderSearchResult?: (item: BarcodeScannerSearchResult<T>, isSelected: boolean) => React.ReactNode;
  /** Disable auto-focus behavior if needed */
  disableAutoFocus?: boolean;
  /** Additional container className */
  className?: string;
}

export default function BarcodeScannerCard<T = unknown>({
  label,
  placeholder,
  value: controlledValue,
  onChangeValue,
  isProcessing = false,
  feedback,
  onScan,
  onSearch,
  onSelectResult,
  renderSearchResult,
  disableAutoFocus = false,
  className = '',
}: BarcodeScannerCardProps<T>) {
  const t = useTranslations('scanToDispatch');
  const [internalValue, setInternalValue] = useState('');
  const [searchResults, setSearchResults] = useState<BarcodeScannerSearchResult<T>[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputValue = controlledValue !== undefined ? controlledValue : internalValue;

  const setInputValue = (val: string) => {
    if (onChangeValue) {
      onChangeValue(val);
    } else {
      setInternalValue(val);
    }
  };

  // Hardware scanner auto-refocus listener
  useEffect(() => {
    if (disableAutoFocus) return;
    inputRef.current?.focus();

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName !== 'INPUT' &&
        target.tagName !== 'SELECT' &&
        target.tagName !== 'BUTTON' &&
        target.tagName !== 'A' &&
        !containerRef.current?.contains(target)
      ) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [disableAutoFocus]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search when onSearch prop is provided
  const triggerSearch = useCallback(
    async (query: string) => {
      if (!onSearch) return;
      const term = query.trim();
      if (!term || term.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await onSearch(term);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
        setSelectedIndex(results.length > 0 ? 0 : -1);
      } catch {
        // failed to load search results
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (onSearch) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        triggerSearch(val);
      }, 200);
    }
  };

  const handleSelect = (item: BarcodeScannerSearchResult<T>) => {
    setShowDropdown(false);
    setSearchResults([]);
    setInputValue('');
    if (onSelectResult) {
      onSelectResult(item);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
        return;
      }
      if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < searchResults.length) {
        e.preventDefault();
        handleSelect(searchResults[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const code = inputValue.trim();
      if (!code || isProcessing) return;
      setShowDropdown(false);
      onScan(code);
    }
  };

  return (
    <div ref={containerRef} className={`card relative ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <label htmlFor="scanner-input" className="text-sm font-semibold flex items-center gap-2 text-[var(--text-primary)]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          {label || t('scannerActive')}
        </label>
        {(isProcessing || isSearching) && (
          <span className="text-xs text-[var(--accent)] flex items-center gap-1">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
            {t('processing')}
          </span>
        )}
      </div>

      <div className="relative">
        <input
          id="scanner-input"
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('placeholder')}
          className="w-full px-4 py-3 text-base rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-mono"
          autoComplete="off"
          disabled={isProcessing}
        />
        <div className="absolute right-3 top-3.5 text-xs text-[var(--text-muted)] pointer-events-none">
          {t('autoFocusOn')}
        </div>
      </div>

      {/* Floating Live Search Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute left-5 right-5 top-[92px] z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1.5 max-h-64 overflow-y-auto">
          {searchResults.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-2.5 rounded-md cursor-pointer flex items-center justify-between text-sm transition-colors ${
                  isSelected ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium' : 'hover:bg-[var(--bg-secondary)]/70 text-[var(--text-secondary)]'
                }`}
              >
                {renderSearchResult ? (
                  renderSearchResult(item, isSelected)
                ) : (
                  <>
                    <div className="min-w-0 pr-2">
                      <span className="font-mono font-bold text-[var(--accent)]">{item.primaryText}</span>
                      {item.secondaryText && (
                        <span className="ml-2 text-[var(--text-primary)]">{item.secondaryText}</span>
                      )}
                    </div>
                    {item.extraText && (
                      <span className="font-semibold text-xs text-[var(--text-muted)] shrink-0">
                        {item.extraText}
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Live Feedback Banner */}
      {feedback && (
        <div className="mt-4">
          <InlineAlert
            type={feedback.type}
            message={
              <div>
                <div className="font-bold">{feedback.message}</div>
                {feedback.detail && <div className="text-xs mt-0.5">{feedback.detail}</div>}
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
