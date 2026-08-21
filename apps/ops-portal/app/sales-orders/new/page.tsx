'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const parseInitialPhone = (val: string) => {
  if (!val) return '';
  if (val.startsWith('+')) return val;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0) return '+' + digits;
  return '';
};

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import { Button } from '@/components/shared/Button';
import DetailsLayout from '@/components/shared/DetailsLayout';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { formatAmount } from '@/lib/currency';
import { useTranslations } from 'next-intl';
import CustomerSelect from '@/components/shared/CustomerSelect';
import DeliveryAddressSlideOver from '@/components/shared/DeliveryAddressSlideOver';
import { MobileCardField } from '@/components/shared/DataTable';
import { computeLinePrice, computeOrderTotals, calculateUomPriceAdjustment, resolveEffectiveDiscount, getTaxLabel } from '@herobm/shared';
import type { DiscountRule } from '@herobm/shared';
import { formatLocationDisplay } from '@/lib/formatters';
import { useSettings } from '@/components/SettingsProvider';

interface Customer {
  customerId: string;
  customerNumber: string;
  name: string;
  customerGroupId?: string | null;
  customerDiscount?: string | null;
  currencyCode?: string | null;
  taxPosition?: string | null;
  taxPositionId?: string | null;
  customerGroupTaxPositionId?: string | null;
  gstCategoryName?: string | null;
  deliveryAddresses?: api.DeliveryAddressResponseDto[] | null;
  billingAddressCountry?: string | null;
}

interface Location {
  locationId: string;
  name: string;
  code?: string;
}

interface TaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
  isDefault: boolean;
}

interface TaxPositionMapping {
  mappingId: string;
  taxPositionId: string;
  sourceTaxCategoryId: string;
  destinationTaxCategoryId: string;
}

interface LineItem {
  key: number;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  taxCategoryId: string;
  unitOfMeasure: string;
  fulfillmentLocationId: string;
  baseUom?: string | null;
  productUoms?: { uomCode: string; ratio?: string | number }[];
  productGroupId?: string | null;
  salesTaxCategoryId?: string | null;
}

let lineKey = 0;

function emptyLine(defaultDiscount = '0', defaulttaxCategoryId = '', defaultLocationId = ''): LineItem {
  const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
  return {
    key: ++lineKey,
    productId: CUSTOM_LINE_ID,
    productNumber: '',
    productDescription: '',
    quantity: '1',
    pricePerUnit: '0',
    discountPercentage: defaultDiscount,
    taxCategoryId: defaulttaxCategoryId,
    unitOfMeasure: 'EA',
    fulfillmentLocationId: defaultLocationId,
  };
}

function useDebounce(fn: (...args: unknown[]) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: unknown[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function NewOrderPage() {
  const { baseCurrency, app } = useSettings();
  useDocumentTitle('New Sales Order');
  const tSales = useTranslations();
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDiscount, setCustomerDiscount] = useState('0');
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [currencyCode, setCurrencyCode] = useState('');
  const [customerTaxPosition, setCustomerTaxPosition] = useState<string | null>(null);
  const [customerTaxPositionId, setCustomerTaxPositionId] = useState<string | null>(null);
  const [customerGroupTaxPositionId, setCustomerGroupTaxPositionId] = useState<string | null>(null);
  const [taxPositionMappings, setTaxPositionMappings] = useState<TaxPositionMapping[]>([]);
  const [name, setName] = useState('');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [analysisCode, setAnalysisCode] = useState('');
  const [customerCountry, setCustomerCountry] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  const configuredAnalysisCodes: api.OrderedSettingDto[] = useMemo(() => {
    const codes = (app?.salesAnalysisCodes as api.OrderedSettingDto[]) || [];
    return [...codes].sort((a, b) => a.order - b.order);
  }, [app?.salesAnalysisCodes]);
  const [customerDeliveryAddresses, setCustomerDeliveryAddresses] = useState<api.DeliveryAddressResponseDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddressSlideOverOpen, setIsAddressSlideOverOpen] = useState(false);
  const [deliveryCompanyName, setDeliveryCompanyName] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddressLine1, setDeliveryAddressLine1] = useState('');
  const [deliveryAddressLine2, setDeliveryAddressLine2] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('');

  const [taxCategories, settaxCategories] = useState<TaxCategory[]>([]);
  const defaulttaxCategoryId =
    taxCategories.find((c) => c.type === 'tax_applies')?.taxCategoryId ||
    taxCategories.find((c) => parseFloat(c.rate || '0') > 0)?.taxCategoryId ||
    taxCategories[0]?.taxCategoryId ||
    '';
  const exempttaxCategoryId = taxCategories.find((c) => c.type === 'exempt')?.taxCategoryId || '';
  const isCustomerExempt = customerTaxPosition?.toLowerCase() === 'exempt';

  const resolveTaxCategoryIdForLine = useCallback(
    (productSalesTaxCategoryId?: string | null) => {
      if (isCustomerExempt && exempttaxCategoryId) {
        return exempttaxCategoryId;
      }
      const effectiveTaxPositionId = customerTaxPositionId || customerGroupTaxPositionId;
      const baseTaxId = productSalesTaxCategoryId || defaulttaxCategoryId;

      if (effectiveTaxPositionId && baseTaxId) {
        const mapping = taxPositionMappings.find(
          (m) =>
            m.taxPositionId === effectiveTaxPositionId &&
            m.sourceTaxCategoryId === baseTaxId,
        );
        if (mapping) {
          return mapping.destinationTaxCategoryId;
        }
      }
      return baseTaxId;
    },
    [
      isCustomerExempt,
      exempttaxCategoryId,
      customerTaxPositionId,
      customerGroupTaxPositionId,
      defaulttaxCategoryId,
      taxPositionMappings,
    ],
  );

  const [lines, setLines] = useState<LineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [locations, setLocations] = useState<Location[]>([]);
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState('');

  // Load locations on mount
  useEffect(() => {
    api.inventoryControllerFindAllLocations({} )
      .then((res) => {
        const payload = res.data || [];
        setLocations(payload);
        if (payload.length > 0) {
          setFulfillmentLocationId((payload[0] ).locationId);
        }
      })
      .catch((err) => reportError(err, 'NewOrderPage_Locations'));
  }, []);

  // Load GST categories on mount
  useEffect(() => {
    api.taxCategoriesControllerFindAll()
      .then((res) => {
        settaxCategories((res.data || []).map((t: import('@herobm/sdk').TaxCategoryResponseDto) => ({ ...t, taxCategoryId: (t as unknown as {id?: string}).id || t.taxCategoryId } as unknown as TaxCategory)) );
      })
      .catch((err) => reportError(err, 'NewOrderPage'));
  }, []);

  // Load tax position mappings on mount
  useEffect(() => {
    api.taxPositionMappingsControllerFindAll()
      .then((res) => {
        setTaxPositionMappings((res.data || []) as unknown as TaxPositionMapping[]);
      })
      .catch((err) => reportError(err, 'NewOrderPage_TaxMappings'));
  }, []);

  // When GST categories load or customer changes, backfill effective GST onto lines missing one
  useEffect(() => {
    if (!defaulttaxCategoryId) return;
    setLines((prev) =>
      prev.map((l) =>
        l.taxCategoryId ? l : { ...l, taxCategoryId: resolveTaxCategoryIdForLine(l.salesTaxCategoryId) },
      ),
    );
  }, [defaulttaxCategoryId, resolveTaxCategoryIdForLine]);

  // Select customer logic
  const selectCustomer = async (a: Customer) => {
    setCustomerId(a.customerId);
    setCustomerName(a.name || '');
    setCustomerSearch(`${a.customerNumber} — ${a.name}`);
    
    // Fetch discount rules for this customer
    let rules: DiscountRule[] = [];
    try {
      const res = await api.discountMatrixControllerResolve({ customerId: a.customerId, customerGroupId: a.customerGroupId || '' });
      rules = res.data as unknown as DiscountRule[];
      setDiscountRules(rules);
    } catch (err) {
      reportError(err, 'NewOrderPage_Rules');
    }

    const baseDisc = resolveEffectiveDiscount(rules, null);
    setCustomerDiscount(baseDisc);
    
    const resolvedCurrency = a.currencyCode || '';
    setCurrencyCode(resolvedCurrency);
    setCustomerTaxPosition(a.taxPosition ?? a.gstCategoryName ?? null);
    setCustomerTaxPositionId(a.taxPositionId || null);
    setCustomerGroupTaxPositionId(a.customerGroupTaxPositionId || null);

    api.customersControllerFindOne(a.customerId)
      .then((res) => {
        const customer = res.data as unknown as Customer;
        setCustomerDeliveryAddresses((customer.deliveryAddresses as unknown as api.DeliveryAddressResponseDto[]) || []);
        setCustomerCountry(customer.billingAddressCountry || undefined);
        if (customer.taxPositionId) setCustomerTaxPositionId(customer.taxPositionId);
        if (customer.customerGroupTaxPositionId) setCustomerGroupTaxPositionId(customer.customerGroupTaxPositionId);
      })
      .catch((err) => {
        reportError(err, 'NewOrderPage_CustomerDetails');
        setCustomerDeliveryAddresses([]);
        setCustomerCountry(undefined);
      });

    setShippingNotes('');
    setDeliveryCompanyName(a.name || '');
    setDeliveryName('');
    setDeliveryPhone('');
    setDeliveryAddressLine1('');
    setDeliveryAddressLine2('');
    setDeliveryCity('');
    setDeliveryState('');
    setDeliveryPostalCode('');
    setDeliveryCountry('');
    setSelectedAddressId('');

    // Update discount + GST on all existing lines
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        discountPercentage: resolveEffectiveDiscount(rules, l.productGroupId || null),
        taxCategoryId: resolveTaxCategoryIdForLine(l.salesTaxCategoryId),
      })),
    );
  };

  const addLineFromProduct = (p: Product) => {
    if (lines.some((l) => l.productId === p.productId)) {
      setError(tSales('toast.productAlreadyInOrder', { productNumber: p.productNumber }));
      return;
    }
    setError('');
    const lineTaxCategoryId = resolveTaxCategoryIdForLine(p.salesTaxCategoryId);
    setLines((prev) => [
      ...prev,
      {
        key: ++lineKey,
        productId: p.productId,
        productNumber: p.productNumber,
        productDescription: p.name,
        quantity: '1',
        pricePerUnit: parseFloat(p.listPrice || p.tradePrice || '0').toFixed(2),
        discountPercentage: resolveEffectiveDiscount(discountRules, p.productGroupId || null),
        taxCategoryId: lineTaxCategoryId,
        unitOfMeasure: p.baseUom || 'EA',
        fulfillmentLocationId,
        baseUom: p.baseUom,
        productUoms: p.productUoms as LineItem['productUoms'],
        productGroupId: p.productGroupId || null,
        salesTaxCategoryId: p.salesTaxCategoryId || null,
      },
    ]);
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string) => {
    let sanitizedValue = value;
    if (field === 'discountPercentage') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        if (num < 0) sanitizedValue = '0';
        else if (num > 100) sanitizedValue = '100';
      }
    }
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: sanitizedValue } : l)),
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    const customLineTaxId = resolveTaxCategoryIdForLine(null);
    setLines((prev) => [...prev, emptyLine(customerDiscount, customLineTaxId, fulfillmentLocationId)]);
  };

  const computeAmount = (line: LineItem) => {
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
    }).amount;
  };

  const computeTax = (line: LineItem) => {
    const cat = taxCategories.find((c) => c.taxCategoryId === line.taxCategoryId);
    const rate = cat ? parseFloat(cat.rate || '0') : 0;
    return computeLinePrice({
      quantity: parseFloat(line.quantity) || 0,
      pricePerUnit: parseFloat(line.pricePerUnit) || 0,
      discountPercentage: parseFloat(line.discountPercentage) || 0,
      taxRate: rate,
    }).tax;
  };

  const handleSubmit = async () => {
    if (!customerId) {
      setError(tSales('common.errors.pleaseSelectCustomer'));
      return;
    }
    if (!currencyCode) {
      setError(tSales('salesOrders.errors.noCurrency'));
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.productId)) {
      setError(tSales('common.errors.pleaseAddLineItem'));
      return;
    }

    const hasInvalidDiscount = lines.some((l) => {
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
      const orderRes = await api.ordersControllerCreate({
        salesOrderId: crypto.randomUUID(),
        name: name || undefined,
        customerId,
        customerOrderNumber: customerOrderNumber || undefined,
        fulfillmentLocationId: fulfillmentLocationId || undefined,
        notes: notes || undefined,
        shippingNotes: shippingNotes || undefined,
        deliveryCompanyName: deliveryCompanyName || undefined,
        deliveryName: deliveryName || undefined,
        deliveryPhone: deliveryPhone || undefined,
        deliveryAddressLine1: deliveryAddressLine1 || undefined,
        deliveryAddressLine2: deliveryAddressLine2 || undefined,
        deliveryCity: deliveryCity || undefined,
        deliveryState: deliveryState || undefined,
        deliveryPostalCode: deliveryPostalCode || undefined,
        deliveryCountry: deliveryCountry || undefined,
        customFields: analysisCode ? { analysisCode } : undefined,
        lines: lines
          .filter((l) => l.productId)
          .map((l) => ({
            productId: l.productId,
            productDescription: l.productDescription,
            quantity: String(l.quantity),
            pricePerUnit: String(l.pricePerUnit),
            discountPercentage: String(l.discountPercentage),
            taxCategoryId: l.taxCategoryId || undefined,
            unitOfMeasure: l.unitOfMeasure,
            fulfillmentLocationId: l.fulfillmentLocationId || fulfillmentLocationId || undefined,
          })),
      });
      const order = orderRes.data;
      router.push(`/sales-orders/${order.salesOrderId}`);
      return;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tSales('common.errors.failedToCreateOrder'));
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
            title={tSales('salesOrders.createTitle')}
            isSaving={submitting}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/sales-orders')}
                  disabled={submitting}
                >
                  {tSales('common.cancel')}
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
                      {tSales('common.saving')}
                    </>
                  ) : (
                    tSales('salesOrders.buttons.createOrder')
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
            {tSales('salesOrders.orderDetails')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer selector */}
            <div className="relative">
              <label
                className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]"
              >
                {tSales('salesOrders.labels.customer')} *
                {customerId && (
                  <span
                    className="ml-2 px-1.5 py-px rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wider"
                  >
                    {currencyCode}
                  </span>
                )}
                {isCustomerExempt && (
                    <span
                      className="ml-1 px-1.5 py-px rounded bg-amber-500/15 text-amber-500 font-semibold text-[10px] tracking-wider"
                    >
                      {tSales('common.taxLabels.exempt')}
                    </span>
                )}
                {customerId && parseFloat(customerDiscount) > 0 && (
                    <span
                      className="ml-1 px-1.5 py-px rounded bg-green-500/15 text-green-400 font-semibold text-[10px] tracking-wider"
                    >
                      {tSales('salesOrders.discountPercent', { disc: parseFloat(customerDiscount) })}
                    </span>
                )}
              </label>
              <CustomerSelect
                value={customerId}
                onChange={(acc) => {
                  if (acc) {
                    selectCustomer(acc);
                  } else {
                    setCustomerId('');
                    setCustomerSearch('');
                  }
                }}
                placeholder={tSales('salesOrders.placeholders.searchCustomers')}
                required
              />
            </div>

             <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSales('salesOrders.labels.customerPO')}
              </label>
              <input
                id="order-po"
                className="input"
                placeholder={tSales('salesOrders.placeholders.customerPO')}
                value={customerOrderNumber}
                onChange={(e) => setCustomerOrderNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSales('salesOrders.labels.orderName')}
              </label>
              <input
                id="order-name"
                className="input"
                placeholder={tSales('salesOrders.placeholders.orderName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Analysis Code
              </label>
              <select
                id="order-analysis-code"
                className="input w-full"
                value={analysisCode}
                onChange={(e) => setAnalysisCode(e.target.value)}
              >
                <option value="">— None —</option>
                {configuredAnalysisCodes.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
                {analysisCode && !configuredAnalysisCodes.some((c) => c.value === analysisCode) && (
                  <option value={analysisCode}>
                    {analysisCode} (Custom)
                  </option>
                )}
              </select>
            </div>


            <div className="md:col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSales('common.notesCardHeading')}
              </label>
              <textarea
                id="order-notes"
                className="input w-full min-h-[80px] pt-3 resize-y"
                placeholder={tSales('common.notesCardPlaceholder')}
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
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined">list</span>
              {tSales('salesOrders.lineItems')}
            </h3>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <ProductSearchInput
                  onSelect={addLineFromProduct}
                  placeholder={tSales('salesOrders.placeholders.searchProduct')}
                  fulfillmentLocationId={fulfillmentLocationId}
                />
              </div>
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addLine}>
                {tSales('salesOrders.buttons.customLine')}
              </Button>
            </div>
          </div>

          <div className="lg:hidden flex flex-col gap-3 w-full mt-4">
            {lines.length === 0 ? (
              <div className="text-center text-slate-500 py-4 px-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                {tSales('salesOrders.noLineItems')}
              </div>
            ) : (
              lines.map((line, idx) => (
                <div key={line.key} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-semibold text-sm text-[var(--accent)]">
                      {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                        <span>{line.productNumber}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{idx + 1}</div>
                  </div>
                  <div className="text-sm text-slate-600 font-medium mb-3">
                      <input
                        className="input w-full text-sm h-8 !py-1"
                        value={line.productDescription || ''}
                        onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                        placeholder={tSales('salesOrders.placeholders.customDescription')}
                      />
                  </div>
                  <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                    <MobileCardField label={tSales('salesOrders.columns.qty')} value={
                      <input
                        className="input text-right w-24 h-8 text-sm !py-1"
                        type="number"
                        min="0"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      />
                    } />
                    <MobileCardField label={tSales('salesOrders.columns.uom')} value={
                      (() => {
                        const uoms = line.productUoms || [];
                        const defaultUom = line.baseUom || 'EA';
                        const selectOptions = uoms.length > 0 ? uoms : [{ uomCode: defaultUom, ratio: 1 }];
                        return (
                          <select
                            className="input text-right w-24 h-8 text-sm !py-1"
                            value={line.unitOfMeasure || defaultUom}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              const oldVal = line.unitOfMeasure || defaultUom;
                              if (newVal !== oldVal) {
                                const oldO = selectOptions.find((o: { uomCode: string; ratio?: string | number }) => o.uomCode === oldVal);
                                const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
                                const newO = selectOptions.find((o: { uomCode: string; ratio?: string | number }) => o.uomCode === newVal);
                                const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);
                                const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          unitOfMeasure: newVal,
                                          pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2),
                                        }
                                      : l
                                  )
                                );
                              }
                            }}
                          >
                            {selectOptions.map((o: { uomCode: string; ratio?: string | number }) => (
                              <option key={o.uomCode} value={o.uomCode}>
                                {o.uomCode}
                              </option>
                            ))}
                          </select>
                        );
                      })()
                    } />
                    <MobileCardField label={tSales('salesOrders.columns.unitPrice')} value={
                      <input
                        className="input text-right w-24 h-8 text-sm !py-1"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.pricePerUnit}
                        onChange={(e) => updateLine(idx, 'pricePerUnit', e.target.value)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateLine(idx, 'pricePerUnit', val.toFixed(2));
                        }}
                      />
                    } />
                    <MobileCardField label={tSales('salesOrders.columns.discountPct')} value={
                      <input
                        className="input text-right w-20 h-8 text-sm !py-1"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={line.discountPercentage}
                        onChange={(e) => updateLine(idx, 'discountPercentage', e.target.value)}
                      />
                    } />
                    <MobileCardField label={tSales('salesOrders.columns.tax')} value={
                      <select
                        className="input text-right w-32 h-8 text-sm !py-1"
                        value={line.taxCategoryId}
                        onChange={(e) => updateLine(idx, 'taxCategoryId', e.target.value)}
                      >
                        {taxCategories.map((c) => (
                          <option key={c.taxCategoryId} value={c.taxCategoryId}>
                            {getTaxLabel(c)}
                          </option>
                        ))}
                      </select>
                    } />
                    <MobileCardField label={tSales('salesOrders.columns.amount')} value={
                      <span className="font-bold text-[var(--accent)] text-base">{formatAmount(computeAmount(line), currencyCode)}</span>
                    } />
                    <div className="flex justify-end mt-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(idx)}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} /> {tSales('common.buttons.remove')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {lines.length > 0 && (() => {
              const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
              return (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col mt-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-semibold text-slate-500">{tSales('common.subtotal')}</span>
                    <span className="text-sm font-semibold">{formatAmount(subtotal, currencyCode)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-slate-500">
                      {tSales('common.tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                    </span>
                    <span className="text-sm font-semibold">{formatAmount(totalTax, currencyCode)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-slate-700">{tSales('common.total')}</span>
                    <span className="text-lg font-bold text-[var(--accent)]">{formatAmount(subtotal + totalTax, currencyCode)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="table-lines w-full">
            <thead>
              <tr>
                <th className="w-10">{tSales('salesOrders.columns.lineNumber')}</th>
                <th>{tSales('salesOrders.columns.product')}</th>
                <th>{tSales('salesOrders.columns.description')}</th>
                <th className="w-[90px] text-right">{tSales('salesOrders.columns.qty')}</th>
                <th className="w-20 text-right">{tSales('salesOrders.columns.uom')}</th>
                <th className="w-[110px] text-right">{tSales('salesOrders.columns.unitPrice')}</th>
                <th className="w-20 text-right">{tSales('salesOrders.columns.discountPct')}</th>
                <th className="w-[110px] text-right">{tSales('salesOrders.columns.tax')}</th>
                <th className="w-[110px] text-right">{tSales('salesOrders.columns.amount')}</th>
                <th className="w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key}>
                  <td className="text-[var(--text-muted)]">{idx + 1}</td>
                  <td className="text-[var(--accent)] font-semibold text-xs">
                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      <div className="flex items-center gap-2">
                        <span>{line.productNumber}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] font-normal">—</span>
                    )}
                  </td>
                  <td>
                      <input
                        className="input w-full text-[13px]"
                        value={line.productDescription || ''}
                        onChange={(e) => updateLine(idx, 'productDescription', e.target.value)}
                        placeholder={tSales('salesOrders.placeholders.customDescription')}
                      />
                  </td>
                  <td className="text-right">
                    <input
                      className="input w-full text-right"
                      type="number"
                      min="0"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="text-right">
                    {(() => {
                      const uoms = line.productUoms || [];
                      const defaultUom = line.baseUom || 'EA';
                      const selectOptions = uoms.length > 0 ? uoms : [{ uomCode: defaultUom, ratio: 1 }];
                      
                      return (
                        <select
                          className="input w-full text-[13px] text-right"
                          value={line.unitOfMeasure || defaultUom}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            const oldVal = line.unitOfMeasure || defaultUom;
                            if (newVal !== oldVal) {
                              const oldO = selectOptions.find((o: { uomCode: string; ratio?: string | number }) => o.uomCode === oldVal);
                              const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);

                              const newO = selectOptions.find((o: { uomCode: string; ratio?: string | number }) => o.uomCode === newVal);
                              const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);

                              const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                              
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        unitOfMeasure: newVal,
                                        pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2),
                                      }
                                    : l
                                )
                              );
                            }
                          }}
                        >
                          {selectOptions.map((o: { uomCode: string; ratio?: string | number }) => (
                            <option key={o.uomCode} value={o.uomCode}>
                              {o.uomCode}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </td>
                  <td className="text-right">
                    <input
                      className="input w-full text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.pricePerUnit}
                      onChange={(e) => updateLine(idx, 'pricePerUnit', e.target.value)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) updateLine(idx, 'pricePerUnit', val.toFixed(2));
                      }}
                    />
                  </td>
                  <td className="text-right">
                    <input
                      className="input w-full text-right"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.discountPercentage}
                      onChange={(e) => updateLine(idx, 'discountPercentage', e.target.value)}
                    />
                  </td>
                  <td className="text-right">
                    <select
                      className="input w-full text-xs text-right"
                      value={line.taxCategoryId}
                      onChange={(e) => updateLine(idx, 'taxCategoryId', e.target.value)}
                    >
                      {taxCategories.map((c) => (
                        <option key={c.taxCategoryId} value={c.taxCategoryId}>
                          {getTaxLabel(c)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className="text-right font-semibold tabular-nums"
                  >
                    {formatAmount(computeAmount(line), currencyCode)}
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeLine(idx)}
                    >
                      <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                    </Button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center text-[var(--text-muted)] py-5"
                  >
                    {tSales('salesOrders.noLineItems')}
                  </td>
                </tr>
              )}
              {lines.length > 0 && (() => {
                const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                return (
                  <>
                    <tr className="border-t-2 border-[var(--border)]">
                      <td colSpan={8} className="text-right font-semibold text-[var(--text-muted)]">
                        {tSales('common.subtotal')}
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {formatAmount(subtotal, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="text-right font-semibold text-[var(--text-muted)]">
                        {tSales('common.tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {formatAmount(totalTax, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                    <tr className="bg-blue-500/[0.02]">
                      <td colSpan={8} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
                        {tSales('common.total')}
                      </td>
                      <td className="text-right font-extrabold text-sm text-[var(--accent)] tabular-nums">
                        {formatAmount(subtotal + totalTax, currencyCode)}
                      </td>
                      <td></td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Delivery section */}
        <div className="card">
          <h3 className="section-heading mb-4">
            { }
            <span className="material-symbols-outlined">local_shipping</span>
            Delivery
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="flex flex-col gap-4">
              <div className="mt-2">
                { }
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Delivery Address
                </label>
                <select
                  className="input w-full mb-2"
                  value={selectedAddressId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAddressId(val);
                    if (val === 'other') {
                      setIsAddressSlideOverOpen(true);
                    } else {
                      const addr = customerDeliveryAddresses.find(a => a.deliveryAddressId === val);
                      if (addr) {
                        if (addr.companyName && addr.companyName.trim()) {
                          setDeliveryCompanyName(addr.companyName.trim());
                        }
                        setDeliveryName(addr.recipientName || '');
                        setDeliveryPhone(addr.recipientPhone || '');
                        setDeliveryAddressLine1(addr.addressLine1 || '');
                        setDeliveryAddressLine2(addr.addressLine2 || '');
                        setDeliveryCity(addr.city || '');
                        setDeliveryState(addr.stateOrProvince || '');
                        setDeliveryPostalCode(addr.postalCode || '');
                        setDeliveryCountry(addr.country || '');
                      }
                    }
                  }}
                >
                  <option value="" disabled>Select an address...</option>
                  {customerDeliveryAddresses.map(addr => (
                    <option key={addr.deliveryAddressId} value={addr.deliveryAddressId}>
                      {addr.addressName ? `${addr.addressName} - ` : ''}{addr.addressLine1}, {addr.city}
                    </option>
                  ))}
                  <option value="other">Other...</option>
                </select>
                <div className="grid grid-cols-2 gap-4 mb-2 mt-2">
                  <div className="col-span-2">
                    <input
                      className="input w-full"
                      placeholder="Company Name"
                      value={deliveryCompanyName}
                      onChange={(e) => setDeliveryCompanyName(e.target.value)}
                    />
                  </div>
                  <input
                    className="input w-full"
                    placeholder="Attention To"
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                  />
                  <div>
                    <PhoneInput
                      international
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
                      defaultCountry={customerCountry as any}
                      className="input w-full flex items-center px-2 border border-[var(--border)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]"
                      value={parseInitialPhone(deliveryPhone)}
                      onChange={(value) => setDeliveryPhone(value || '')}
                      placeholder="Phone"
                    />
                    {deliveryPhone && !deliveryPhone.startsWith('+') && (
                      <p className="text-xs text-orange-500 mt-1">{tCommon('rawPhone', { phone: deliveryPhone })}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                { }
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Shipping Instructions
                </label>
                <textarea
                  id="shipping-notes"
                  className="input w-full min-h-[80px] pt-3 resize-y"
                  placeholder="Add shipping instructions..."
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tSales('salesOrders.labels.fulfillmentLocation')}
              </label>
              <select
                className="input w-full"
                value={fulfillmentLocationId}
                onChange={(e) => setFulfillmentLocationId(e.target.value)}
              >
                {locations.length === 0 && <option value="" disabled>{tSales('common.loadingEllipsis')}</option>}
                {locations.map((loc) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {formatLocationDisplay(loc)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </DetailsLayout>

      {customerId && (
        <DeliveryAddressSlideOver
          isOpen={isAddressSlideOverOpen}
          onClose={() => setIsAddressSlideOverOpen(false)}
          customerId={customerId}
          customerName={customerName}
          allowUnsaved={true}
          defaultCountry={customerCountry}
          onSaved={(addr, saved) => {
            if (addr.companyName && addr.companyName.trim()) {
              setDeliveryCompanyName(addr.companyName.trim());
            }
            setDeliveryName(addr.recipientName || '');
            setDeliveryPhone(addr.recipientPhone || '');
            setDeliveryAddressLine1(addr.addressLine1 || '');
            setDeliveryAddressLine2(addr.addressLine2 || '');
            setDeliveryCity(addr.city || '');
            setDeliveryState(addr.stateOrProvince || '');
            setDeliveryPostalCode(addr.postalCode || '');
            setDeliveryCountry(addr.country || '');
            if (saved && addr.deliveryAddressId) {
              setCustomerDeliveryAddresses([...customerDeliveryAddresses, addr as api.DeliveryAddressResponseDto]);
              setSelectedAddressId(addr.deliveryAddressId);
            } else {
              setSelectedAddressId('other');
            }
          }}
        />
      )}
    </>
  );
}
