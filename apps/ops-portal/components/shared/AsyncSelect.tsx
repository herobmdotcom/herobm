'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
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
  
  onSearch: (term: string) => Promise<T[]>;
  onChange: (item: T | null) => void;
  
  getKey: (item: T) => string;
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
  onSearch,
  onChange,
  getKey,
  renderOption,
  clearOnSelect,
  noResultsText = 'No matching results',
  typeMinCharsText = 'Type at least 2 characters to search...',
}: AsyncSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState(displayValue);
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
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
    if (clearOnSelect) {
      setSearchTerm('');
      setResults([]);
    }
    onChange(item);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    onChange(null);
  };

  return (
    <div className="relative" ref={containerRef} style={style}>
      <div className="relative flex items-center">
        <input
          className={`input ${className || ''}`}
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
        {searchTerm && !disabled && !clearOnSelect && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 text-xs cursor-pointer text-gray-400 hover:text-gray-600 !w-4 !h-4"
            onClick={handleClear}
          >
            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
          </Button>
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
          {results.map((item) => (
            <div
              key={getKey(item)}
              className="px-3 py-2 cursor-pointer text-sm"
              style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
              onMouseDown={(e) => {
                if (!clearOnSelect) e.preventDefault();
                handleSelect(item);
              }}
            >
              {renderOption(item)}
            </div>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {searchTerm.trim().length < 2 ? typeMinCharsText : noResultsText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
