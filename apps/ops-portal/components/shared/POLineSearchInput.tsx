'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';

interface POLine {
  purchaseOrderLineId: string;
  orderNumber: string;
  quantity: string;
  quantityReceived: string;
  vendorName?: string;
}

interface POLineSearchInputProps {
  productId?: string;
  vendorId?: string;
  onSelect: (poLineId: string, line?: POLine) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function POLineSearchInput({
  productId,
  vendorId,
  onSelect,
  placeholder = 'Search POs...',
  style,
  disabled,
}: POLineSearchInputProps) {
  const t = useTranslations('purchaseOrders');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<POLine[]>([]);
  const [allLines, setAllLines] = useState<POLine[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!productId && !vendorId) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (productId) params.productId = productId;
    if (vendorId) params.vendorId = vendorId;
    
    api.purchaseOrdersControllerFindPendingLines(params as Parameters<typeof api.purchaseOrdersControllerFindPendingLines>[0])
      .then((data) => {
        const lines = data as unknown as POLine[];
        setAllLines(lines);
        setResults(lines);
        if (lines.length > 0) {
          setShowDropdown(true);
        }
      })
      .catch(() => {
        setAllLines([]);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [productId, vendorId]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
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
    if (!term) {
      setResults(allLines);
    } else {
      const lower = term.toLowerCase();
      setResults(
        allLines.filter(
          (l) =>
            l.orderNumber?.toLowerCase().includes(lower) ||
            l.vendorName?.toLowerCase().includes(lower)
        )
      );
    }
  };

  const handleSelect = (line: POLine) => {
    setShowDropdown(false);
    setSearch(line.orderNumber);
    onSelect(line.purchaseOrderLineId, line);
  };

  const dropdownContent = showDropdown ? (
    <div
      className="z-50 rounded-lg overflow-hidden max-h-48 scroll-area"
      style={{
        position: 'fixed',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        ...dropdownStyle
      }}
    >
      {results.map((p) => {
        const qtyPending = parseFloat(p.quantity || '0') - parseFloat(p.quantityReceived || '0');
        return (
          <div
            key={p.purchaseOrderLineId}
            className="px-3 py-2 cursor-pointer text-sm hover:bg-[var(--bg-card-hover)]"
            style={{ borderBottom: '1px solid rgba(30,58,95,0.3)' }}
            onMouseDown={() => handleSelect(p)}
          >
            <div className="flex flex-col gap-1 pt-1 pb-0.5">
              <div style={{ minWidth: 0 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {p.orderNumber}
                </span>
                {p.vendorName && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                    {p.vendorName}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('pendingQty')}: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{qtyPending}</span>
              </div>
            </div>
          </div>
        );
      })}
      {results.length === 0 && !loading && (
        <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('noPendingPos')}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative" style={style}>
      <input
        ref={inputRef}
        className="input"
        autoFocus
        style={{ width: '100%', fontSize: 12, padding: '4px 8px', height: 26 }}
        placeholder={loading ? 'Loading POs...' : placeholder}
        value={search}
        onChange={(e) => handleSearch(e.target.value.trimStart())}
        onFocus={() => setShowDropdown(true)}
        onBlur={(e) => {
          setSearch(e.target.value.trim());
          setTimeout(() => setShowDropdown(false), 200);
        }}
        disabled={loading}
      />
      {typeof document !== 'undefined' && showDropdown && createPortal(dropdownContent, document.body)}
    </div>
  );
}
