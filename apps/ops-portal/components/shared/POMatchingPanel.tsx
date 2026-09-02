'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { formatAmount } from '../../lib/currency';
import { Button } from './Button';
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
    <div className="card flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="section-heading mb-0">
          {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
          <span className="material-symbols-outlined">link</span>
          {t('matching.panelTitle')}
        </h3>
        {/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="px-2 h-7 text-xs"
        >
          ✕
        </Button>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {/* Search */}
      <div className="mb-2 shrink-0">
        <input
          className="input w-full text-xs"
          placeholder={t('placeholders.searchOrders')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.trimStart())}
          onBlur={(e) => setSearchTerm(e.target.value.trim())}
        />
      </div>

      {/* Selected line hint */}
      {selectedLineId ? (
        <div className="py-1.5 px-2.5 -mx-5 text-[11px] text-[var(--accent)] bg-[rgba(0,107,92,0.06)] border-b border-[var(--border)] font-semibold shrink-0">
          { }
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">
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
        <div className="py-2 px-2.5 -mx-5 text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] shrink-0">
          {t('matching.selectInvoiceLine')}
        </div>
      )}

      {/* Body */}
      <div className="scroll-area flex-1 overflow-y-auto -mx-2 mt-2 px-2">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-[13px]">
            {tCommon('loading')}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-[13px]">
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
    <div className="mb-2 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
      {/* Card header */}
      <Button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2.5 px-3.5 bg-transparent border-0 cursor-pointer text-[13px] text-left"
      >
        <div className="flex items-center gap-2">
          { }
          <span
            className={`material-symbols-outlined text-[16px] transition-transform duration-150 text-[var(--text-muted)] ${
              isExpanded ? 'rotate-90' : 'rotate-0'
            }`}
          >
            chevron_right
          </span>
          { }
          <span className="font-bold text-[var(--accent)]">
            {group.orderNumber}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <span>{t('matching.linesCount', { count: group.lines.length })}</span>
          {group.matchableCount > 0 && (
            <span className="bg-[rgba(0,107,92,0.1)] text-[var(--accent)] py-0.5 px-1.5 rounded font-semibold">
              {t('matching.matchableCount', { count: group.matchableCount })}
            </span>
          )}
        </div>
      </Button>

      {/* Expanded lines */}
      {isExpanded && (
        <div className="border-t border-[var(--border)]">
          {/* Auto-match button */}
          {group.matchableCount > 0 && (
            <div className="py-1.5 px-3.5 border-b border-[var(--border)] flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="text-[11px] py-0.5 px-2.5 h-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoMatch();
                }}
              >
                {t('matching.autoMatchAll')}
              </Button>
            </div>
          )}

          {/* Line table */}
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                <th className="py-1.5 pl-3.5 pr-2 text-left font-semibold">
                  {t('columns.product')}
                </th>
                <th className="py-1.5 px-2 text-right font-semibold">
                  {t('columns.ordered')}
                </th>
                <th className="py-1.5 px-2 text-right font-semibold">
                  {t('columns.received')}
                </th>
                <th className="py-1.5 px-2 text-right font-semibold">
                  {t('columns.billed')}
                </th>
                <th className="py-1.5 pl-2 pr-3.5 text-right font-semibold">
                  {t('matching.remaining')}
                </th>
                <th className="py-1.5 px-2 w-[60px]"></th>
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
                    className={`border-b border-[var(--border)] ${
                      isFullyInvoiced || isAlreadyMatched ? 'opacity-45' : ''
                    }`}
                  >
                    <td className="py-1.5 pl-3.5 pr-2">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                      </div>
                      <div
                        className="text-[10px] text-[var(--text-muted)] max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap"
                        title={line.productDescription || ''}
                      >
                        {line.productDescription || ''}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {ordered}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right tabular-nums ${
                        received >= ordered && ordered > 0
                          ? 'text-[var(--badge-shipped)] font-semibold'
                          : 'font-normal'
                      }`}
                    >
                      {received}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {invoiced}
                    </td>
                    <td
                      className={`py-1.5 pl-2 pr-3.5 text-right tabular-nums font-semibold ${
                        remaining > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {remaining}
                    </td>
                    <td className="py-1 px-2 text-center">
                      {isAlreadyMatched ? (
                        <span className="text-[10px] text-[var(--badge-shipped)] font-semibold">
                          {t('matching.matched')}
                        </span>
                      ) : isFullyInvoiced ? (
                        <span className="text-[10px] text-[var(--text-muted)]">—</span>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            className="py-0.5 px-2 h-[22px] text-[10px] font-semibold"
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
                          </Button>
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
