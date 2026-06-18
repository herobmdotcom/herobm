'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatAmount } from '../../lib/currency';
import { MATCH_STATUS } from '@herobm/shared';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PendingPOLine {
  purchaseOrderId: string;
  orderNumber: string;
  purchaseOrderName: string | null;
  vendorName: string | null;
  stateCode: string;
  vendorId: string;
  currencyCode: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  productId: string | null;
  productNumber: string | null;
  productDescription: string | null;
  quantity: string;
  pricePerUnit: string;
  quantityReceived: string;
  quantityInvoiced: string;
}

interface POGroup {
  purchaseOrderId: string;
  orderNumber: string;
  name: string | null;
  stateCode: string;
  currencyCode: string;
  lines: PendingPOLine[];
  matchableCount: number;
}

interface InvoiceLine {
  lineId: string;
  matchStatus: string;
  productId?: string;
  productNumber?: string;
  description: string;
  purchaseOrderLineId?: string;
  purchaseOrderNumber?: string;
}

interface POMatchingPanelProps {
  vendorId: string;
  currencyCode: string;
  invoiceLines: InvoiceLine[];
  selectedLineId: string | null;
  onMatch: (invoiceLineId: string, purchaseOrderLineId: string) => void;
  onAutoMatch: (purchaseOrderId: string) => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function POMatchingPanel({
  vendorId,
  currencyCode,
  invoiceLines,
  selectedLineId,
  onMatch,
  onAutoMatch,
  onClose,
}: POMatchingPanelProps) {
  const t = useTranslations('purchaseOrders');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [rawLines, setRawLines] = useState<PendingPOLine[]>([]);
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch PO lines for this vendor
  useEffect(() => {
    if (!vendorId) return;
    setLoading(true);
    api.purchaseOrdersControllerFindPendingLines({ vendorId } as Parameters<typeof api.purchaseOrdersControllerFindPendingLines>[0])
      .then((res) => {

        const lines = res.data as unknown as PendingPOLine[];
        setRawLines(lines);
        // Auto-expand all POs if 3 or fewer, otherwise expand the first
        const poIds = [...new Set(lines.map((l: PendingPOLine) => l.purchaseOrderId))] as string[];
        if (poIds.length <= 3) {
          setExpandedPOs(new Set(poIds));
        } else if (poIds.length > 0) {
          setExpandedPOs(new Set([poIds[0]]));
        }
      })
      .catch(() => setRawLines([]))
      .finally(() => setLoading(false));
  }, [vendorId]);

  // Set of PO line IDs already matched on the current invoice
  const alreadyMatchedPoLineIds = useMemo(() => {
    return new Set(
      invoiceLines
        .filter((il) => il.matchStatus === MATCH_STATUS.MATCHED && il.purchaseOrderLineId)
        .map((il) => il.purchaseOrderLineId!),
    );
  }, [invoiceLines]);

  // Group raw lines by PO
  const poGroups: POGroup[] = useMemo(() => {
    const map = new Map<string, POGroup>();
    for (const line of rawLines) {
      if (!map.has(line.purchaseOrderId)) {
        map.set(line.purchaseOrderId, {
          purchaseOrderId: line.purchaseOrderId,
          orderNumber: line.orderNumber,
          name: line.purchaseOrderName,
          stateCode: line.stateCode,
          currencyCode: line.currencyCode,
          lines: [],
          matchableCount: 0,
        });
      }
      const group = map.get(line.purchaseOrderId)!;
      group.lines.push(line);

      const ordered = parseFloat(line.quantity || '0');
      const invoiced = parseFloat(line.quantityInvoiced || '0');
      const remaining = ordered - invoiced;
      if (remaining > 0 && !alreadyMatchedPoLineIds.has(line.purchaseOrderLineId)) {
        group.matchableCount++;
      }
    }
    return Array.from(map.values());
  }, [rawLines, alreadyMatchedPoLineIds]);

  // Filter by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return poGroups;
    const lower = searchTerm.toLowerCase();
    return poGroups.filter(
      (g) =>
        g.orderNumber.toLowerCase().includes(lower) ||
        g.name?.toLowerCase().includes(lower),
    );
  }, [poGroups, searchTerm]);

  const toggleExpand = (poId: string) => {
    setExpandedPOs((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) {
        next.delete(poId);
      } else {
        next.add(poId);
      }
      return next;
    });
  };

  const handleMatchClick = (poLineId: string) => {
    if (!selectedLineId) return;
    onMatch(selectedLineId, poLineId);
  };

  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
        <h3 className="section-heading" style={{ marginBottom: 0 }}>
          {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
          <span className="material-symbols-outlined">link</span>
          {t('matching.panelTitle')}
        </h3>
        {/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
        <button
          onClick={onClose}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0 8px', height: 28, fontSize: 12 }}
        >
          ✕
        </button>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 8, flexShrink: 0 }}>
        <input
          className="input"
          style={{ width: '100%', fontSize: 12 }}
          placeholder={t('placeholders.searchOrders')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.trimStart())}
          onBlur={(e) => setSearchTerm(e.target.value.trim())}
        />
      </div>

      {/* Selected line hint */}
      {selectedLineId ? (
        <div
          style={{
            padding: '6px 10px',
            margin: '0 -20px',
            fontSize: 11,
            color: 'var(--accent)',
            background: 'rgba(0, 107, 92, 0.06)',
            borderBottom: '1px solid var(--border)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          { }
          <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
            arrow_back
          </span>
          {(() => {
            const selected = invoiceLines.find((l) => l.lineId === selectedLineId);
            return selected
              ? `Matching: ${selected.description || selected.productNumber || 'Line'}`
              : t('matching.selectInvoiceLine');
          })()}
        </div>
      ) : (
        <div
          style={{
            padding: '8px 10px',
            margin: '0 -20px',
            fontSize: 11,
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {t('matching.selectInvoiceLine')}
        </div>
      )}

      {/* Body */}
      <div
        className="scroll-area"
        style={{ flex: 1, overflowY: 'auto', margin: '8px -8px 0', padding: '0 8px' }}
      >
        {loading ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            {tCommon('loading')}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            {t('matching.noPendingPOs')}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <POCard
              key={group.purchaseOrderId}
              group={group}
              currencyCode={currencyCode}
              isExpanded={expandedPOs.has(group.purchaseOrderId)}
              onToggle={() => toggleExpand(group.purchaseOrderId)}
              selectedLineId={selectedLineId}
              alreadyMatchedPoLineIds={alreadyMatchedPoLineIds}
              onMatchClick={handleMatchClick}
              onAutoMatch={() => onAutoMatch(group.purchaseOrderId)}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PO Card                                                             */
/* ------------------------------------------------------------------ */

function POCard({
  group,
  currencyCode,
  isExpanded,
  onToggle,
  selectedLineId,
  alreadyMatchedPoLineIds,
  onMatchClick,
  onAutoMatch,
  t,
}: {
  group: POGroup;
  currencyCode: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedLineId: string | null;
  alreadyMatchedPoLineIds: Set<string>;
  onMatchClick: (poLineId: string) => void;
  onAutoMatch: () => void;
  t: ReturnType<typeof useTranslations<'purchaseOrders'>>;
}) {
  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 8,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        background: 'var(--bg-card, #fff)',
      }}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          { }
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              transition: 'transform 0.15s',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}
          >
            chevron_right
          </span>
          { }
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
            {group.orderNumber}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>{t('matching.linesCount', { count: group.lines.length })}</span>
          {group.matchableCount > 0 && (
            <span
              style={{
                background: 'rgba(0, 107, 92, 0.1)',
                color: 'var(--accent)',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {t('matching.matchableCount', { count: group.matchableCount })}
            </span>
          )}
        </div>
      </button>

      {/* Expanded lines */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Auto-match button */}
          {group.matchableCount > 0 && (
            <div
              style={{
                padding: '6px 14px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '2px 10px', height: 24 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoMatch();
                }}
              >
                {t('matching.autoMatchAll')}
              </button>
            </div>
          )}

          {/* Line table */}
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '6px 8px 6px 14px', textAlign: 'left', fontWeight: 600 }}>
                  {t('columns.product')}
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {t('columns.ordered')}
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {t('columns.received')}
                </th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                  {t('columns.billed')}
                </th>
                <th style={{ padding: '6px 8px 6px 14px', textAlign: 'right', fontWeight: 600 }}>
                  {t('matching.remaining')}
                </th>
                <th style={{ padding: '6px 8px', width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {group.lines.map((line) => {
                const ordered = parseFloat(line.quantity || '0');
                const received = parseFloat(line.quantityReceived || '0');
                const invoiced = parseFloat(line.quantityInvoiced || '0');
                const remaining = Math.max(0, ordered - invoiced);
                const isFullyInvoiced = remaining <= 0;
                const isAlreadyMatched = alreadyMatchedPoLineIds.has(line.purchaseOrderLineId);
                const isDisabled = isFullyInvoiced || isAlreadyMatched || !selectedLineId;

                return (
                  <tr
                    key={line.purchaseOrderLineId}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: isFullyInvoiced || isAlreadyMatched ? 0.45 : 1,
                    }}
                  >
                    <td style={{ padding: '6px 8px 6px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={line.productDescription || ''}
                      >
                        {line.productDescription || ''}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {ordered}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color:
                          received >= ordered && ordered > 0
                            ? 'var(--badge-shipped)'
                            : undefined,
                        fontWeight: received >= ordered && ordered > 0 ? 600 : 400,
                      }}
                    >
                      {received}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {invoiced}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px 6px 14px',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: remaining > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {remaining}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      {isAlreadyMatched ? (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--badge-shipped)',
                            fontWeight: 600,
                          }}
                        >
                          {t('matching.matched')}
                        </span>
                      ) : isFullyInvoiced ? (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{
                              padding: '2px 8px',
                              height: 22,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                            disabled={isDisabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMatchClick(line.purchaseOrderLineId);
                            }}
                            title={
                              !selectedLineId
                                ? t('matching.selectInvoiceLine')
                                : t('matching.matchButton')
                            }
                          >
                            {t('matching.matchButton')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Inner helper — needs access to onMatchClick from closure
  function handleMatchClick(poLineId: string) {
    onMatchClick(poLineId);
  }
}
