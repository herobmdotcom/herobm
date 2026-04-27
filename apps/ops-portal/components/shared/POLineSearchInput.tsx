'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../lib/api';

interface POLine {
  purchaseOrderLineId: string;
  orderNumber: string;
  quantity: string;
  quantityReceived: string;
  vendorName?: string;
}

interface POLineSearchInputProps {
  productId: string;
  vendorId?: string;
  onSelect: (poLineId: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function POLineSearchInput({
  productId,
  vendorId,
  onSelect,
  placeholder = 'Search POs...',
  style,
}: POLineSearchInputProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<POLine[]>([]);
  const [allLines, setAllLines] = useState<POLine[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    let url = `/api/purchase-orders/pending-lines?productId=${productId}`;
    if (vendorId) {
      url += `&vendorId=${vendorId}`;
    }
    apiFetch<any>(url)
      .then((data) => {
        const lines = Array.isArray(data) ? data : data.data || [];
        setAllLines(lines);
        setResults(lines);
      })
      .catch(() => {
        setAllLines([]);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [productId, vendorId]);

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
    onSelect(line.purchaseOrderLineId);
  };

  return (
    <div className="relative" style={style}>
      <input
        className="input"
        style={{ width: '100%', fontSize: 12, padding: '4px 8px', height: 26 }}
        placeholder={loading ? 'Loading POs...' : placeholder}
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        disabled={loading}
      />
      {showDropdown && (
        <div
          className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden max-h-48 scroll-area"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: 200,
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
                    Pending Qty: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{qtyPending}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {results.length === 0 && !loading && (
            <div className="px-3 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              No pending POs found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
