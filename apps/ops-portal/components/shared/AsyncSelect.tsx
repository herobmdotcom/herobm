'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { Button } from './Button';

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export interface AsyncSelectProps<T> {
  value?: string | null;
  displayValue?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  viewUrl?: string;
  viewUrlTitle?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  shortcutHint?: string;

  onSearch: (term: string) => Promise<T[]>;
  onChange: (item: T | null) => void;

  getKey: (item: T) => string;
  getLabel?: (item: T) => string;
  renderOption: (item: T) => ReactNode;

  clearOnSelect?: boolean;
  noResultsText?: string;
  typeMinCharsText?: string;
}

export default function AsyncSelect<T>({
  value,
  displayValue = '',
  placeholder,
  disabled,
  required,
  className,
  style,
  viewUrl,
  viewUrlTitle,
  inputRef,
  shortcutHint,
  onSearch,
  onChange,
  getKey,
  getLabel,
  renderOption,
  clearOnSelect,
  noResultsText = 'No matching results',
  typeMinCharsText = 'Type at least 2 characters to search...',
}: AsyncSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState(displayValue);
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isTypingRef = useRef(false);

  // Sync display value when it changes externally
  useEffect(() => {
    if (isTypingRef.current) {
      return;
    }
    if (!value) {
      setSearchTerm('');
    } else if (displayValue) {
      setSearchTerm(displayValue);
    }
  }, [value, displayValue]);

  useEffect(() => {
    isTypingRef.current = false;
  });

  // Reset highlight to first option whenever results change
  useEffect(() => {
    setHighlightedIndex(0);
    optionRefs.current = optionRefs.current.slice(0, results.length);
  }, [results]);

  // Keep highlighted option scrolled into view
  useEffect(() => {
    if (showDropdown && results.length > 0) {
      const el = optionRefs.current[highlightedIndex];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, showDropdown, results.length]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = useCallback(async (rawTerm: string) => {
    const term = rawTerm.trim();
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    try {
      const data = await onSearch(term);
      setResults(data);
    } catch {
      setResults([]);
    }
  }, [onSearch]);

  const debouncedSearch = useDebounce((term: string) => executeSearch(term), 300);

  const handleSelect = (item: T) => {
    setShowDropdown(false);
    setHighlightedIndex(0);
    if (clearOnSelect) {
      setSearchTerm('');
      setResults([]);
    } else if (getLabel) {
      setSearchTerm(getLabel(item));
    }
    onChange(item);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    setResults([]);
    setHighlightedIndex(0);
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showDropdown && searchTerm) {
        setShowDropdown(true);
      }
      if (results.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!showDropdown && searchTerm) {
        setShowDropdown(true);
      }
      if (results.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      if (showDropdown && results.length > 0 && results[highlightedIndex]) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      if (showDropdown) {
        e.preventDefault();
        setShowDropdown(false);
      }
    }
  };

  return (
    <div className="relative" ref={containerRef} style={style}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          className={`input ${viewUrl && value && searchTerm && !disabled ? 'pr-14' : (searchTerm || shortcutHint) && !disabled ? 'pr-8' : ''} ${className || ''}`}
          style={style ? { width: '100%' } : undefined}
          autoComplete="off"
          placeholder={placeholder || 'Search...'}
          value={searchTerm}
          disabled={disabled}
          required={required && !value}
          onChange={(e) => {
            const val = e.target.value.trimStart();
            isTypingRef.current = true;
            setSearchTerm(val);
            setShowDropdown(true);
            if (value && !clearOnSelect) onChange(null);
            debouncedSearch(val);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={(e) => {
            if (!clearOnSelect) {
              setSearchTerm(e.target.value.trim());
            } else {
              setSearchTerm(e.target.value.trim());
              setTimeout(() => setShowDropdown(false), 200);
            }
          }}
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {shortcutHint && !searchTerm && !disabled && (
            <kbd className="pointer-events-none select-none inline-flex items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--text-muted)] leading-none">
              {shortcutHint}
            </kbd>
          )}
          {viewUrl && value && (
            <Link
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-0.5 rounded flex items-center justify-center cursor-pointer"
              title={viewUrlTitle || 'View details'}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </Link>
          )}
          {searchTerm && !disabled && !clearOnSelect && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-xs cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] !w-4 !h-4"
              onClick={handleClear}
            >
              <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
            </Button>
          )}
        </div>
      </div>

      {showDropdown && searchTerm && !disabled && (
        <div
          role="listbox"
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl"
        >
          {results.map((item, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={getKey(item)}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                role="option"
                aria-selected={isHighlighted}
                className={`px-3 py-2 cursor-pointer text-sm border-b border-[var(--border)] transition-colors ${
                  isHighlighted
                    ? 'bg-[var(--bg-card-hover)] ring-1 ring-inset ring-[var(--accent)]/30'
                    : 'hover:bg-[var(--bg-card-hover)]'
                }`}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                {renderOption(item)}
              </div>
            );
          })}
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm text-[var(--text-muted)]">
              {searchTerm.trim().length < 2 ? typeMinCharsText : noResultsText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
