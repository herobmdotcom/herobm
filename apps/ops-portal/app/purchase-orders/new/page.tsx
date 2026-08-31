'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { formatAmount, CURRENCIES } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import { computeLinePrice, computeOrderTotals, CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import LocationSelect from '@/components/shared/LocationSelect';
import SupplierSelect from '@/components/shared/SupplierSelect';
import { MobileCardField } from '@/components/shared/DataTable';
import { getTaxLabel } from '../[id]/types';
import { OrderLinesTable } from '@/components/shared/OrderLinesTable';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/shared/Button';

interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

interface Supplier {
  vendorId: string;
  vendorNumber: string;
  name: string;
  currencyCode: string;
}

interface LineItem {
  key: number;
  lineType?: string;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  unitOfMeasure: string;
  discountPercentage: string;
  taxCategoryId: string | null;
}

let lineKey = 0;

function emptyLine(defaultTaxCategoryId = ''): LineItem {
  return {
    key: ++lineKey,
    lineType: LineType.PRODUCT,
    productId: CUSTOM_LINE_ID,
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0.00',
    unitOfMeasure: 'EA',
    discountPercentage: '0',
    taxCategoryId: defaultTaxCategoryId || null,
  };
}

function emptyCommentLine(): LineItem {
  return {
    key: ++lineKey,
    lineType: LineType.COMMENT,
    productId: '',
    productNumber: '',
    productDescription: '',
    quantity: '0',
    pricePerUnit: '0',
    unitOfMeasure: 'EA',
    discountPercentage: '0',
    taxCategoryId: null,
  };
}

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
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
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const defaultTaxCategoryId = taxCategories.find((c) => c.isDefault)?.taxCategoryId || '';

  useEffect(() => {
    api.taxCategoriesControllerFindAll()
      .then((res) => {
        setTaxCategories(res.data.map(t => ({ ...t, taxCategoryId: t.taxCategoryId })) as TaxCategory[] || []);
      })
      .catch((err) => reportError(err, 'NewPurchaseOrderPage'));
  }, []);

  // When tax categories load, backfill the default onto lines that have none
  useEffect(() => {
    if (!defaultTaxCategoryId) return;
    setLines((prev) =>
      prev.map((l) => (l.taxCategoryId ? l : { ...l, taxCategoryId: defaultTaxCategoryId })),
    );
  }, [defaultTaxCategoryId]);

  const [vendorId, setVendorId] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [name, setName] = useState('');
  const [deliveryLocationId, setDeliveryLocationId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<LineItem[]>([]);
  const prevLineCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLineCountRef.current !== null && lines.length > prevLineCountRef.current) {
      const el = document.getElementById('new-po-lines-bottom');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    prevLineCountRef.current = lines.length;
  }, [lines.length]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');



  const addBlankLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey, // Assuming 'key' is still needed for React lists
        productId: CUSTOM_LINE_ID,
        productNumber: '', // Added to match LineItem interface
        productDescription: '',
        quantity: '1',
        pricePerUnit: '0.00',
        unitOfMeasure: 'EA',
        discountPercentage: '0',
        taxCategoryId: defaultTaxCategoryId || null,
      },
    ]);
  };

  const addLineFromProduct = (p: Product) => {
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey,
        productId: p.productId,
        productNumber: p.productNumber,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.standardCost || p.tradePrice || p.listPrice || '0').toFixed(2),
        unitOfMeasure: 'EA',
        discountPercentage: '0',
        taxCategoryId: defaultTaxCategoryId || null,
      },
    ]);
  };

  const updateLine = (keyOrIdx: number | string, field: keyof LineItem, value: string) => {
    let sanitizedValue = value;
    if (field === 'discountPercentage') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (num < 0) sanitizedValue = '0';
        else if (num > 100) sanitizedValue = '100';
      }
    }
    setLines((prev) =>
      prev.map((l, i) =>
        l.key === keyOrIdx || String(l.key) === String(keyOrIdx) || i === Number(keyOrIdx)
          ? { ...l, [field]: sanitizedValue }
          : l,
      ),
    );
  };

  const removeLine = (keyOrIdx: number | string) => {
    setLines((prev) =>
      prev.filter(
        (l, i) =>
          l.key !== keyOrIdx &&
          String(l.key) !== String(keyOrIdx) &&
          i !== Number(keyOrIdx),
      ),
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(defaultTaxCategoryId)]);
  };

  const addCommentLine = () => {
    setLines((prev) => [...prev, emptyCommentLine()]);
  };

  const computeTax = (line: LineItem) => {
    if (line.lineType === LineType.COMMENT) return 0;
    const cat = taxCategories.find(c => c.taxCategoryId === line.taxCategoryId);
    if (!cat) {
      const defaultCat = taxCategories.find(c => c.isDefault);
      if (!defaultCat) return 0;
      return computeLinePrice({
        quantity: parseFloat(line.quantity) || 0,
        pricePerUnit: parseFloat(line.pricePerUnit) || 0,
        discountPercentage: parseFloat(line.discountPercentage) || 0,
        taxRate: parseFloat(defaultCat.rate) || 0,
      }).tax;
    }
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
      taxRate: parseFloat(cat.rate) || 0,
    }).tax;
  };

  const computeAmount = (line: LineItem) => {
    if (line.lineType === LineType.COMMENT) return 0;
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
    }).amount;
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      setError(t('common.errors.pleaseSelectSupplier'));
      return;
    }
    if (!deliveryLocationId) {
      setError(t('common.errors.pleaseSelectLocation'));
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId || l.lineType === LineType.COMMENT)) {
      setError(t('common.errors.pleaseAddLineItem'));
      return;
    }

    const hasInvalidDiscount = lines.some((l) => {
      if (l.lineType === LineType.COMMENT) return false;
      const d = parseFloat(l.discountPercentage || '0');
      return isNaN(d) || d < 0 || d > 100;
    });
    if (hasInvalidDiscount) {
      setError('Discount percentage must be between 0 and 100');
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
        lines: lines
          .filter((l) => l.productId || l.lineType === LineType.COMMENT)
          .map((l) => ({
            lineType: (l.lineType as api.CreateOrderLineDtoLineType) || api.CreateOrderLineDtoLineType.Product,
            productId: l.lineType === LineType.COMMENT ? undefined : l.productId,
            productDescription: l.productDescription,
            quantity: l.lineType === LineType.COMMENT ? '0' : String(l.quantity),
            pricePerUnit: l.lineType === LineType.COMMENT ? '0' : String(l.pricePerUnit),
            unitOfMeasure: l.lineType === LineType.COMMENT ? undefined : l.unitOfMeasure,
            discountPercentage: l.lineType === LineType.COMMENT ? '0' : String(l.discountPercentage),
            taxCategoryId: l.lineType === LineType.COMMENT ? undefined : (l.taxCategoryId || undefined),
          })),
      });
      router.push(`/purchase-orders/${res.data.purchaseOrderId}`);
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.failedToCreatePO'));
      setSubmitting(false);
    }
  };

  const mappedLines = lines.map(l => ({
    amount: computeAmount(l),
    tax: computeTax(l)
  }));
  const totals = computeOrderTotals(mappedLines);
  const subtotal = totals.subtotal;
  const totalTax = totals.totalTax;

  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title={t('purchaseOrders.createTitle')}
            isSaving={submitting}
            actions={
              <>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => router.push('/purchase-orders')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary" size="sm"
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
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Order header */}
          <div className="card">
          <h3 className="section-heading">
            { }
            <span className="material-symbols-outlined">receipt_long</span>
            {t('purchaseOrders.orderDetails')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]"
              >
                {t('purchaseOrders.labels.supplier')} *
                {vendorId && (
                  <span
                    className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wide"
                  >
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

        {/* Line items */}
        <div className="card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <h3 className="section-heading !mb-0 shrink-0">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined">list</span>
              {t('purchaseOrders.lineItems')}
            </h3>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <ProductSearchInput
                  onSelect={addLineFromProduct}
                  placeholder={t('purchaseOrders.placeholders.searchProduct')}
                />
              </div>
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addLine}>
                {t('purchaseOrders.buttons.customLine')}
              </Button>
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addCommentLine}>
                {t('purchaseOrders.buttons.commentLine')}
              </Button>
            </div>
          </div>

          <OrderLinesTable
            lines={lines}
            currencyCode={currencyCode}
            taxCategories={taxCategories}
            mode="purchase"
            isEditable={true}
            allowCatalogDescriptionEdit={false}
            subtotal={subtotal}
            totalTax={totalTax}
            onUpdateLine={(keyOrIdx, field, val) => updateLine(keyOrIdx as number, field as keyof LineItem, String(val))}
            onUpdateLineFields={(keyOrIdx, fields) =>
              setLines((prev) =>
                prev.map((l, i) =>
                  l.key === keyOrIdx || String(l.key) === String(keyOrIdx) || i === Number(keyOrIdx)
                    ? { ...l, ...fields }
                    : l,
                ),
              )
            }
            onRemoveLine={(keyOrIdx) => removeLine(keyOrIdx as number)}
          />
          <div id="new-po-lines-bottom" className="h-px w-full" />
        </div>
        </div>
      </DetailsLayout>
    </>
  );
}
