/* eslint-disable i18next/no-literal-string -- Material symbols icon names and UI glyphs */
'use client';

import React from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { formatLocalDate } from '@/lib/date';
import type { MovementItemDto, MovementLedgerLineDto } from './MovementContent';

interface MovementDetailSlideOverProps {
  product: MovementItemDto | null;
  movements: MovementLedgerLineDto[];
  onClose: () => void;
}

export default function MovementDetailSlideOver({
  product,
  movements,
  onClose,
}: MovementDetailSlideOverProps) {
  const t = useTranslations('demand.movement');

  if (!product) return null;

  const productMovements = movements.filter((m) => m.productId === product.productId);

  const locationText = product.locationName ? `${product.locationCode} (${product.locationName})` : t('allLocations');
  const groupText = product.productGroupName || t('allProductGroups');
  const systemText = t('system');

  return (
    <SlideOver
      isOpen={!!product}
      onClose={onClose}
      title={`${product.productNumber} — ${product.productName}`}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
          <span>{groupText}</span>
          <span>•</span>
          <span>{locationText}</span>
          <span>•</span>
          <span>{t('columns.uom')}: {product.baseUom}</span>
        </div>
      }
      width="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.openingStock')}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-[var(--text-primary)]">
              {product.openingQuantity.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.stockIn')}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              +{product.stockIn.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.stockOut')}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
              -{product.stockOut.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.netMovement')}
            </div>
            <div
              className={`mt-1 text-sm font-bold font-mono ${
                product.netMovement >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {product.netMovement > 0 ? `+${product.netMovement.toLocaleString()}` : product.netMovement.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.closingStock')}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-[var(--text-primary)]">
              {product.closingQuantity.toLocaleString()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('columns.currentOnHand')}
            </div>
            <div className="mt-1 text-sm font-bold font-mono text-[var(--text-secondary)]">
              {product.currentOnHand.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Detailed Transactions List */}
        <div>

          {productMovements.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] text-sm text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-3xl mb-1 text-[var(--text-muted)] block">
                inbox
              </span>
              {t('noMovements')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">{t('columns.date')}</th>
                    <th className="py-2.5 px-3">{t('columns.document')}</th>
                    <th className="py-2.5 px-3">{t('columns.type')}</th>
                    <th className="py-2.5 px-3">{t('columns.location')} / {t('columns.bin')}</th>
                    <th className="py-2.5 px-3 text-right">{t('columns.quantityChange')}</th>
                    <th className="py-2.5 px-3">{t('columns.memo')}</th>
                    <th className="py-2.5 px-3">{t('columns.actor')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {productMovements.map((line) => {
                    const qty = Number(line.quantity ?? 0);
                    const lineLocation = line.binNumber
                      ? `${line.locationCode} (${line.binNumber})`
                      : line.locationCode;
                    const actorName = line.createdBy || systemText;
                    return (
                      <tr
                        key={line.ledgerId}
                        className="hover:bg-[var(--bg-card-hover)] transition-colors"
                      >
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                          {formatLocalDate(line.entryDate, undefined, '')}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono font-medium text-[#006b5c] dark:text-emerald-400">
                          <Link
                            href={routes.inventory.ledger(line.entryId)}
                            className="hover:underline"
                          >
                            {line.entryNumber}
                          </Link>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--text-primary)]">
                          {line.sourceType}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--text-secondary)]">
                          {lineLocation}
                        </td>
                        <td
                          className={`py-2 px-3 whitespace-nowrap font-mono font-bold text-right ${
                            qty > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : qty < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {qty > 0 ? `+${qty.toLocaleString()}` : qty.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-[var(--text-secondary)]" title={line.memo || ''}>
                          {line.memo ? line.memo : '—'}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">
                          {actorName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
