'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

import React from 'react';
import LocationSelect from '@/components/shared/LocationSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { useTranslations } from 'next-intl';

interface DraftLine {
  id: string;
  productId: string;
  productNumber?: string;
  productName: string;
  quantityReceived: number;
}

interface CompletedLine {
  goodsReceivedLineId: string;
  productId: string;
  productNumber: string;
  productName: string;
  quantityReceived: string;
  matchStatus: string;
  orderNumber?: string;
}

function ReceivingFlow() {
  const t = useTranslations('goodsReceived');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('flow.title'));
  const router = useRouter();

  // Header state
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [packingSlipNumber, setPackingSlipNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Draft state
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [qtyToReceive, setQtyToReceive] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Flow state
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedLines, setCompletedLines] = useState<CompletedLine[]>([]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setQtyToReceive('1');
  };

  const addToDraft = () => {
    if (!selectedProduct) return;
    const qty = Number(qtyToReceive);
    if (qty <= 0) {
      toast.error(t('toast.qtyReq'));
      return;
    }

    // Check if product already in draft — if so, add to existing quantity
    const existing = draftLines.find((l) => l.productId === selectedProduct.productId);
    if (existing) {
      setDraftLines(
        draftLines.map((l) =>
          l.productId === selectedProduct.productId
            ? { ...l, quantityReceived: l.quantityReceived + qty }
            : l,
        ),
      );
    } else {
      setDraftLines([
        ...draftLines,
        {
          id: Math.random().toString(36).substring(7),
          productId: selectedProduct.productId,
          productNumber: selectedProduct.productNumber,
          productName: selectedProduct.name,
          quantityReceived: qty,
        },
      ]);
    }

    setSelectedProduct(null);
    setQtyToReceive('');
  };

  const removeDraftLine = (id: string) => {
    setDraftLines(draftLines.filter((l) => l.id !== id));
  };

  const commitReception = async () => {
    if (draftLines.length === 0) return;
    if (!vendorId) {
      toast.error(t('toast.selectSupplier'));
      return;
    }
    if (!locationId) {
      toast.error(t('toast.selectLocation'));
      return;
    }
    setSaving(true);

    const payload = {
      vendorId,
      locationId,
      packingSlipNumber: packingSlipNumber || undefined,
      notes: notes || undefined,
      lines: draftLines.map((l) => ({
        productId: l.productId,
        quantityReceived: String(l.quantityReceived),
      })),
    };

    try {
          quantityReceived: String(l.quantityReceived),
        })),
      }) }) as any;

      setCompletedLines(result.lines || []);
      toast.success(t('toast.confirmed'));
      setCompleted(true);
    } catch (err: any) {
      toast.error(err.message || t('toast.failed'));
    } finally {
      setSaving(false);
    }
  };

  // ── Match status badge ──────────────────────────────────────────────
  const MatchStatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      matched: { bg: 'rgba(16,185,129,0.12)', color: '#059669', label: t('matchStatus.matched') },
      unmatched: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', label: t('matchStatus.unmatched') },
      ambiguous: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: t('matchStatus.ambiguous') },
    };
    const s = styles[status] || styles.unmatched;
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: s.bg,
          color: s.color,
          letterSpacing: '0.02em',
        }}
      >
        {s.label}
      </span>
    );
  };

  // ── Completed screen ────────────────────────────────────────────────
  if (completed) {
    return (
      <DetailsLayout
        header={
          <EntityHeader
            title={t('completed.title')}
            subtitle={t('completed.subtitle')}
            actions={
              <div className="flex gap-2">
                <button className="btn btn-secondary" onClick={() => router.push('/receiving')}>
                  {t('completed.backToList')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCompleted(false);
                    setDraftLines([]);
                    setSelectedProduct(null);
                    setCompletedLines([]);
                    setVendorId(null);
                    setPackingSlipNumber('');
                    setNotes('');
                  }}
                >
                  {t('completed.newReception')}
                </button>
              </div>
            }
            showPrint={false}
          />
        }
      >
        <div className="flex flex-col gap-6">
          <div className="card flex flex-col gap-4">
            {(notes || packingSlipNumber) && (
              <div className="mb-4 flex gap-8 text-sm">
                {packingSlipNumber && (
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      {t('labels.packingSlip')}:
                    </strong>
                    {packingSlipNumber}
                  </div>
                )}
                {notes && (
                  <div>
                    <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      {tCommon('columns.notes')}:
                    </strong>
                    {notes}
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto w-full">
              <table className="table-lines">
                <thead>
                  <tr>
                    <th>{tCommon('columns.product')}</th>
                    <th>{tCommon('columns.description')}</th>
                    <th style={{ width: 100, textAlign: 'right' }}>{tCommon('columns.received')}</th>
                    <th style={{ width: 120 }}>{t('columns.matchStatus')}</th>
                    <th style={{ width: 160 }}>{tCommon('columns.purchaseOrder')}</th>
                  </tr>
                </thead>
                <tbody>
                  {completedLines.map((line) => (
                    <tr key={line.goodsReceivedLineId}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{line.productNumber || '—'}</td>
                      <td style={{ fontSize: 13 }}>{line.productName || '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                        {line.quantityReceived}
                      </td>
                      <td>
                        <MatchStatusBadge status={line.matchStatus} />
                      </td>
                      <td>
                        {line.orderNumber ? (
                          <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--accent)' }}>
                            {line.orderNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DetailsLayout>
    );
  }

  // ── Main flow ───────────────────────────────────────────────────────
  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('flow.title')}
          subtitle={t('flow.subtitle')}
          isSaving={saving}
          actions={
            <button
              className="btn btn-primary"
              onClick={commitReception}
              disabled={draftLines.length === 0 || saving || !vendorId || !locationId}
            >
              {t('flow.confirmReception')}
            </button>
          }
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Package Header */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {t('labels.supplier')} *
              </label>
              <SupplierSelect
                value={vendorId}
                onChange={(s) => setVendorId(s?.vendorId || null)}
                placeholder={t('placeholders.selectSupplier')}
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {t('labels.location')} *
              </label>
              <LocationSelect
                value={locationId}
                onChange={setLocationId}
                placeholder={t('placeholders.selectLocation')}
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {t('labels.packingSlip')}
              </label>
              <input
                className="input"
                placeholder={t('placeholders.packingSlip')}
                value={packingSlipNumber}
                onChange={(e) => setPackingSlipNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.notes')}
              </label>
              <input
                className="input"
                placeholder={t('placeholders.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Product scanner */}
          <h3 className="section-heading mb-0 mt-2">{t('flow.scanProduct')}</h3>

          <div className="flex items-end gap-3">
            {!selectedProduct ? (
              <div className="flex-1">
                <ProductSearchInput
                  onSelect={handleProductSelect}
                  placeholder={t('placeholders.searchProduct')}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('flow.selectedProduct', { fallback: 'Selected Product' })}
                </label>
                <div
                  className="text-sm px-3 flex items-center w-full border rounded outline-none"
                  style={{ 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)', 
                    borderColor: 'var(--border)',
                    height: '38px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={`${selectedProduct.productNumber} — ${selectedProduct.name}`}
                >
                  <span style={{ fontWeight: 600, marginRight: 8, color: 'var(--accent)' }}>{selectedProduct.productNumber}</span>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedProduct.name}</span>
                </div>
              </div>
            )}

            {selectedProduct && (
              <>
                <div style={{ width: 100 }}>
                  <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('columns.qty')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input w-full"
                    value={qtyToReceive}
                    onChange={(e) => setQtyToReceive(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addToDraft();
                    }}
                  />
                </div>
                <button className="btn btn-primary" onClick={addToDraft}>
                  {tCommon('add')}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedProduct(null);
                    setQtyToReceive('');
                  }}
                >
                  {tCommon('cancel')}
                </button>
              </>
            )}
          </div>


        </div>

        {/* Draft Cart */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <h3 className="section-heading">{t('flow.itemsReceived')}</h3>

          {draftLines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('flow.noItems')}</p>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="table-lines">
                <thead>
                  <tr>
                    <th>{tCommon('columns.product')}</th>
                    <th>{tCommon('columns.description')}</th>
                    <th style={{ width: 100, textAlign: 'right' }}>{tCommon('columns.qty')}</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((line) => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{line.productNumber || '—'}</td>
                      <td style={{ fontSize: 13 }}>{line.productName || '—'}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 13,
                        }}
                      >
                        {line.quantityReceived}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => removeDraftLine(line.id)}
                        >
                          {/* eslint-disable i18next/no-literal-string */}
                          ✕
                          {/* eslint-enable i18next/no-literal-string */}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .table-lines {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
        }
        .table-lines th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          border-bottom: 2px solid var(--border);
        }
        .table-lines td {
          padding: 12px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
      `}</style>
    </DetailsLayout>
  );
}

export default function ReceivingPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<p style={{ padding: 20 }}>{tCommon('loading')}</p>}>
      <ReceivingFlow />
    </Suspense>
  );
}
