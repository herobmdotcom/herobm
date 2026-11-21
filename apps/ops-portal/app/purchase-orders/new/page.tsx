'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { CURRENCIES } from '@/lib/currency';
import { resolveProductUnitPrice } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import LocationSelect from '@/components/shared/LocationSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/shared/Button';

interface InitialProductLine {
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  unitOfMeasure: string;
  discountPercentage: string;
}

function generateOrderNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${today}-${rand}`;
}

export default function NewPurchaseOrderPage() {
  const { baseCurrency } = useSettings();
  const t = useTranslations();
  useDocumentTitle(t('purchaseOrders.newOrderTitle'));
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVendorId = searchParams.get('vendorId') || '';
  const initialProductId = searchParams.get('productId') || '';

  const [vendorId, setVendorId] = useState(initialVendorId);
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [name, setName] = useState('');
  const [deliveryLocationId, setDeliveryLocationId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [initialLine, setInitialLine] = useState<InitialProductLine | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function initFromParams() {
      if (initialVendorId) {
        setVendorId(initialVendorId);
        try {
          const res = await api.suppliersControllerFindOne(initialVendorId);
          if (active && res.data?.currencyCode) {
            setCurrencyCode(res.data.currencyCode);
          }
        } catch (err) {
          reportError(err, 'NewPurchaseOrderPage_initVendor');
          if (active) setError(err instanceof Error ? err.message : String(err));
        }
      }

      if (initialProductId) {
        try {
          const prodRes = await api.productsControllerFindOne(initialProductId);
          const prod = prodRes.data;
          if (!prod || !active) return;

          let matchedSupplier:
            | {
                vendorId: string;
                costPrice?: string | null;
                discountPercent?: string | null;
                minPurchaseQty?: string | null;
                purchaseUnit?: string | null;
                purchaseUomCode?: string | null;
                isPreferred?: boolean;
              }
            | undefined;

          try {
            const supRes = await api.suppliersControllerFindByProduct(initialProductId, { limit: 100 });
            const raw = supRes.data;
            const list: Array<{
              vendorId: string;
              costPrice?: string | null;
              discountPercent?: string | null;
              minPurchaseQty?: string | null;
              purchaseUnit?: string | null;
              purchaseUomCode?: string | null;
              isPreferred?: boolean;
            }> = Array.isArray(raw)
              ? raw
              : Array.isArray((raw as { data?: unknown })?.data)
                ? ((raw as { data: unknown[] }).data as never)
                : [];

            if (initialVendorId) {
              matchedSupplier = list.find((s) => s.vendorId === initialVendorId);
            } else if (list.length > 0) {
              matchedSupplier = list.find((s) => s.isPreferred) || list[0];
              if (matchedSupplier?.vendorId && active) {
                setVendorId(matchedSupplier.vendorId);
                try {
                  const vRes = await api.suppliersControllerFindOne(matchedSupplier.vendorId);
                  if (active && vRes.data?.currencyCode) {
                    setCurrencyCode(vRes.data.currencyCode);
                  }
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore
          }

          if (!active) return;

          const moq = matchedSupplier?.minPurchaseQty ? String(matchedSupplier.minPurchaseQty) : '1';
          const costPrice =
            matchedSupplier?.costPrice != null && matchedSupplier.costPrice !== ''
              ? parseFloat(String(matchedSupplier.costPrice)).toFixed(2)
              : resolveProductUnitPrice(prod, { mode: 'purchase' }).toFixed(2);
          const discount = matchedSupplier?.discountPercent ? String(matchedSupplier.discountPercent) : '0';
          const uom = matchedSupplier?.purchaseUomCode || matchedSupplier?.purchaseUnit || prod.baseUom || 'EA';

          setInitialLine({
            productId: prod.productId,
            productNumber: prod.productNumber,
            productDescription: prod.name,
            quantity: moq,
            pricePerUnit: costPrice,
            unitOfMeasure: uom,
            discountPercentage: discount,
          });
        } catch (err) {
          reportError(err, 'NewPurchaseOrderPage_initProduct');
          if (active) setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    initFromParams();
    return () => {
      active = false;
    };
  }, [initialVendorId, initialProductId]);

  const handleSubmit = async () => {
    if (!vendorId) {
      setError(t('common.errors.pleaseSelectSupplier'));
      return;
    }
    if (!deliveryLocationId) {
      setError(t('common.errors.pleaseSelectLocation'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.purchaseOrdersControllerCreate({
        purchaseOrderId: crypto.randomUUID(),
        orderNumber: generateOrderNumber(),
        name: name || undefined,
        vendorId,
        currencyCode,
        deliveryLocationId: deliveryLocationId || '',
        referenceNumber: referenceNumber || undefined,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        notes: notes || undefined,
        lines: initialLine
          ? [
              {
                productId: initialLine.productId,
                productDescription: initialLine.productDescription,
                quantity: initialLine.quantity,
                pricePerUnit: initialLine.pricePerUnit,
                unitOfMeasure: initialLine.unitOfMeasure,
                discountPercentage: initialLine.discountPercentage,
              },
            ]
          : [],
      });
      router.push(`/purchase-orders/${res.data.purchaseOrderId}`);
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToCreatePO'));
      setSubmitting(false);
    }
  };

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('purchaseOrders.createTitle')}
          isSaving={submitting}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/purchase-orders')}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1.5" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('purchaseOrders.buttons.createPO')
                )}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">receipt_long</span>
            {t('purchaseOrders.orderDetails')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier selector */}
            <div className="relative">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('purchaseOrders.labels.supplier')} *
                {vendorId && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wide">
                    {currencyCode}
                  </span>
                )}
              </label>
              <SupplierSelect
                value={vendorId}
                onChange={(s) => {
                  setVendorId(s?.vendorId || '');
                  setCurrencyCode(s?.currencyCode || baseCurrency);
                }}
                placeholder={t('purchaseOrders.placeholders.searchSuppliers')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('purchaseOrders.labels.referenceNumber')}
              </label>
              <input
                id="order-invoice"
                className="input"
                placeholder={t('purchaseOrders.placeholders.referenceNumber')}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('purchaseOrders.labels.expectedDate')}
              </label>
              <input
                id="order-expected-date"
                type="date"
                className="input"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('purchaseOrders.labels.location')} *
              </label>
              <LocationSelect
                value={deliveryLocationId}
                onChange={setDeliveryLocationId}
                placeholder={t('common.selectEllipsis')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('purchaseOrders.labels.orderName')}
              </label>
              <input
                id="order-name"
                className="input"
                placeholder={t('purchaseOrders.placeholders.orderName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('common.columns.currency')}
              </label>
              <select
                id="order-currency"
                className="input"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                disabled={submitting}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('common.notesCardHeading')}
              </label>
              <textarea
                id="order-notes"
                className="input w-full min-h-[80px] pt-3 resize-y"
                placeholder={t('common.notesCardPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
