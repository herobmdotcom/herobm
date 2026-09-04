'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import BarcodeScannerCard from '@/components/shared/BarcodeScannerCard';
import type { BarcodeScannerSearchResult, BarcodeScannerFeedback } from '@/components/shared/BarcodeScannerCard';
import CustomerSelect, { Customer } from '@/components/shared/CustomerSelect';
import { OrderLinesTable } from '@/components/shared/OrderLinesTable';
import { formatAmount } from '@/lib/currency';
import { reportError } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  getErrorMessage,
  computeLinePrice,
  computeOrderTotals,
  SALES_ORDER_STATE,
  CUSTOM_LINE_ID,
  LineType,
  getTaxLabel,
  DATA_SOURCE_CONTEXT,
  PAYMENT_TYPE,
  SYSTEM_WALK_IN_CUSTOMER_ID,
  SYSTEM_WALK_IN_CUSTOMER_NUMBER,
  SYSTEM_WALK_IN_CUSTOMER_NAME,
} from '@herobm/shared';

interface CounterProduct {
  productId: string;
  productNumber?: string;
  name?: string;
  description?: string;
  listPrice?: string;
  tradePrice?: string;
  baseUom?: string | null;
  salesTaxCategoryId?: string | null;
}

interface CounterLineItem {
  key: number;
  lineType?: string;
  productId: string;
  productNumber: string;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  discountPercentage: string;
  taxCategoryId: string;
  taxRate: number;
  unitOfMeasure: string;
  onHand?: number;
}

interface CompletedSaleDetails {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentId?: string;
  paymentNumber?: string;
  totalAmount: number;
  tenderType: string;
}

let lineCounter = 0;

export default function CounterSalesPage() {
  const t = useTranslations('counterSale');
  const tSales = useTranslations('salesOrders');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));
  const router = useRouter();
  const { baseCurrency } = useSettings();

  // State
  const [locations, setLocations] = useState<api.LocationResponseDto[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [taxCategories, setTaxCategories] = useState<api.TaxCategoryResponseDto[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ glAccountId: string; accountCode: string; name: string; accountType?: string }[]>([]);
  const [glSettings, setGlSettings] = useState<api.SettingsResponseDto | null>(null);
  const [defaultCustomerId, setDefaultCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>('');

  const [lines, setLines] = useState<CounterLineItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<BarcodeScannerFeedback | null>(null);

  // Tender & Checkout State
  const [tenderType, setTenderType] = useState<'cash' | 'card' | 'account' | 'direct_deposit'>('cash');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');

  // Completion Modal State
  const [completedSale, setCompletedSale] = useState<CompletedSaleDetails | null>(null);

  const isWalkIn = selectedCustomer?.customerNumber === 'WALK-IN' || selectedCustomer?.name === 'Walk-In Customer';

  // Audio Beep generator for scanner feedback
  const playBeep = useCallback((success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, []);

  // Load locations, tax categories, and look for dedicated Cash/Walk-in customer account
  useEffect(() => {
    async function initData() {
      try {
        const [locRes, custRes, taxRes, bankRes, glSettingsRes] = await Promise.all([
          api.inventoryControllerFindAllLocations(),
          api.customersControllerFindAll({ limit: 100 } as api.CustomersControllerFindAllParams),
          api.taxCategoriesControllerFindAll(),
          api.glControllerGetAccounts({ isBankAccount: 'true' } as Parameters<typeof api.glControllerGetAccounts>[0]),
          api.glControllerGetSettings(),
        ]);

        const locList = (Array.isArray(locRes.data) ? locRes.data : ((locRes.data as unknown as { data: api.LocationResponseDto[] })?.data || [])) as api.LocationResponseDto[];
        setLocations(locList);
        if (locList.length > 0) {
          setSelectedLocationId(locList[0].locationId);
        }

        const taxes = (Array.isArray(taxRes.data) ? taxRes.data : ((taxRes.data as unknown as { data: api.TaxCategoryResponseDto[] })?.data || [])) as api.TaxCategoryResponseDto[];
        setTaxCategories(taxes);

        const rawBanks = (Array.isArray(bankRes.data) ? bankRes.data : ((bankRes.data as unknown as { data: { glAccountId: string; accountCode: string; name: string; accountType?: string }[] })?.data || [])) as { glAccountId: string; accountCode: string; name: string; accountType?: string }[];
        setBankAccounts(rawBanks);

        const settingsData = glSettingsRes.data as api.SettingsResponseDto;
        setGlSettings(settingsData);

        const rawCust = custRes.data as unknown as { data?: Customer[] } | Customer[];
        const custList = (Array.isArray(rawCust) ? rawCust : rawCust?.data || []) as Customer[];

        // Look specifically for a designated Cash Sale customer or canonical Walk-In Customer
        const designatedCash = custList.find(
          (c) =>
            c.customerId === SYSTEM_WALK_IN_CUSTOMER_ID ||
            c.customerNumber?.toLowerCase() === 'walk-in' ||
            c.customerNumber?.toLowerCase() === 'cash' ||
            c.customerNumber?.toLowerCase() === 'walkin' ||
            c.name?.toLowerCase().includes('walk-in') ||
            c.name?.toLowerCase().includes('cash sale') ||
            c.name?.toLowerCase().includes('counter sale'),
        ) || null;

        const backingId = designatedCash?.customerId || SYSTEM_WALK_IN_CUSTOMER_ID;
        setDefaultCustomerId(backingId);

        // Initial default: Walk-In Customer selected
        setSelectedCustomer({
          customerId: backingId,
          customerNumber: designatedCash?.customerNumber || SYSTEM_WALK_IN_CUSTOMER_NUMBER,
          name: designatedCash?.name || SYSTEM_WALK_IN_CUSTOMER_NAME,
          customerDiscount: designatedCash?.customerDiscount || '0',
          currencyCode: designatedCash?.currencyCode || baseCurrency || 'AUD',
        });
      } catch (err) {
        toast.error('Failed to load initial counter data: ' + getErrorMessage(err));
      }
    }

    initData();
  }, [baseCurrency]);

  // Fetch stock on hand for a product at the selected location
  const fetchStockOnHand = useCallback(
    async (productId: string): Promise<number> => {
      if (!selectedLocationId || !productId || productId === CUSTOM_LINE_ID) return 0;
      try {
        const res = await api.inventoryControllerFindByProductIdsBulk({
          productIds: [productId],
          locationId: selectedLocationId,
        });
        const raw = res.data as unknown as { data?: Array<{ productId?: string; quantityOnHand?: string | number; quantityAvailable?: string | number }> } | Array<{ productId?: string; quantityOnHand?: string | number; quantityAvailable?: string | number }>;
        const items = Array.isArray(raw) ? raw : raw?.data || [];
        const match = items.find((i) => i.productId === productId);
        if (match) {
          const qty = parseFloat(String(match.quantityAvailable ?? match.quantityOnHand ?? 0));
          if (!isNaN(qty)) return qty;
        }

        // Fallback: Check location bins directly
        const loc = locations.find((l) => l.locationId === selectedLocationId);
        const locCode = loc?.code;
        const binsRes = await api.inventoryControllerFindBins({
          locationNo: locCode,
          hasStock: true,
          limit: 100,
        } as api.InventoryControllerFindBinsParams);
        const rawBins = binsRes.data as unknown as { data?: Array<{ productId?: string; actualQuantity?: string | number; baseQuantity?: number; isUnavailable?: boolean }> } | Array<{ productId?: string; actualQuantity?: string | number; baseQuantity?: number; isUnavailable?: boolean }>;
        const binRows = Array.isArray(rawBins) ? rawBins : rawBins?.data || [];
        const productBins = binRows.filter(
          (b) => b.productId === productId && b.isUnavailable !== true,
        );
        const sumBins = productBins.reduce(
          (sum, b) => sum + parseFloat(String(b.baseQuantity ?? b.actualQuantity ?? 0)),
          0,
        );
        return isNaN(sumBins) ? 0 : sumBins;
      } catch {
        // fallback: return 0 stock on hand if bin inventory query fails
        return 0;
      }
    },
    [locations, selectedLocationId],
  );

  // Add Product to line items (allows adding even with shortages, displaying standard warning)
  const handleAddProduct = useCallback(
    async (product: CounterProduct) => {
      playBeep(true);

      const onHand = await fetchStockOnHand(product.productId);
      const customerDiscount = parseFloat(selectedCustomer?.customerDiscount || '0');
      const basePrice = parseFloat(product.tradePrice || product.listPrice || '0');

      const defaultTaxCat = taxCategories.find((c) => (c.type === 'tax_applies' || parseFloat(c.rate || '0') > 0)) || taxCategories[0];
      const selectedTaxCat = taxCategories.find((c) => c.taxCategoryId === product.salesTaxCategoryId) || defaultTaxCat;
      const initialTaxRate = selectedTaxCat ? parseFloat(selectedTaxCat.rate || '0') : 0;

      setLines((prev) => {
        const existingIdx = prev.findIndex((l) => l.productId === product.productId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const qtyVal = parseFloat(updated[existingIdx].quantity || '0');
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: String(qtyVal + 1),
            onHand,
          };
          return updated;
        }

        const newLine: CounterLineItem = {
          key: ++lineCounter,
          lineType: LineType.PRODUCT,
          productId: product.productId,
          productNumber: product.productNumber || '',
          productDescription: product.name || product.description || '',
          quantity: '1',
          pricePerUnit: basePrice.toFixed(2),
          discountPercentage: customerDiscount > 0 ? String(customerDiscount) : '0',
          taxCategoryId: selectedTaxCat?.taxCategoryId || '',
          taxRate: initialTaxRate,
          unitOfMeasure: product.baseUom || 'EA',
          onHand,
        };
        return [...prev, newLine];
      });

      setFeedback({
        type: 'success',
        message: `Added ${product.productNumber || product.name}`,
        detail: onHand > 0 ? `Stock on hand: ${onHand} ${product.baseUom || 'EA'}` : 'Shortage: 0 on hand (backorder)',
      });
    },
    [fetchStockOnHand, playBeep, selectedCustomer, taxCategories],
  );

  // Direct Hardware Barcode Scan handler
  const handleDirectBarcodeScan = async (barcode: string) => {
    const query = barcode.trim();
    if (!query) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const res = await api.productsControllerFindAll({ q: query, limit: 10 } as api.ProductsControllerFindAllParams);
      const raw = res.data as unknown as { data?: CounterProduct[] } | CounterProduct[];
      const list = (Array.isArray(raw) ? raw : raw?.data || []) as CounterProduct[];

      if (list.length === 1) {
        await handleAddProduct(list[0]);
      } else if (list.length > 1) {
        const exact = list.find(
          (p) => p.productNumber?.toLowerCase() === query.toLowerCase(),
        );
        if (exact) {
          await handleAddProduct(exact);
        } else {
          await handleAddProduct(list[0]);
        }
      } else {
        playBeep(false);
        setFeedback({
          type: 'error',
          message: `Product not found: "${query}"`,
          detail: 'Check barcode / SKU and scan again.',
        });
      }
    } catch (err) {
      playBeep(false);
      setFeedback({
        type: 'error',
        message: 'Scan failed',
        detail: getErrorMessage(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Search-select handler for live typing autocomplete
  const handleSearchProducts = async (term: string): Promise<BarcodeScannerSearchResult<CounterProduct>[]> => {
    try {
      const res = await api.productsControllerFindAll({ q: term, limit: 8 } as api.ProductsControllerFindAllParams);
      const raw = res.data as unknown as { data?: CounterProduct[] } | CounterProduct[];
      const list = (Array.isArray(raw) ? raw : raw?.data || []) as CounterProduct[];

      return list.map((prod) => ({
        id: prod.productId,
        primaryText: prod.productNumber || prod.name || '',
        secondaryText: prod.name || prod.description || '',
        extraText: formatAmount(parseFloat(prod.tradePrice || prod.listPrice || '0'), baseCurrency),
        data: prod,
      }));
    } catch {
      // failed to load search results
      return [];
    }
  };

  // Handle selection from live search-select dropdown
  const handleSelectProductResult = async (item: BarcodeScannerSearchResult<CounterProduct>) => {
    await handleAddProduct(item.data);
  };

  // Add Custom Line Item
  const addCustomLine = () => {
    const customerDiscount = parseFloat(selectedCustomer?.customerDiscount || '0');
    const defaultTaxCat = taxCategories.find((c) => (c.type === 'tax_applies' || parseFloat(c.rate || '0') > 0)) || taxCategories[0];
    setLines((prev) => [
      ...prev,
      {
        key: ++lineCounter,
        lineType: LineType.PRODUCT,
        productId: CUSTOM_LINE_ID,
        productNumber: '',
        productDescription: '',
        quantity: '1',
        pricePerUnit: '0.00',
        discountPercentage: customerDiscount > 0 ? String(customerDiscount) : '0',
        taxCategoryId: defaultTaxCat?.taxCategoryId || '',
        taxRate: defaultTaxCat ? parseFloat(defaultTaxCat.rate || '0') : 0,
        unitOfMeasure: 'EA',
      },
    ]);
  };

  // Add Comment Line Item
  const addCommentLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: ++lineCounter,
        lineType: LineType.COMMENT,
        productId: '',
        productNumber: '',
        productDescription: '',
        quantity: '0',
        pricePerUnit: '0.00',
        discountPercentage: '0',
        taxCategoryId: '',
        taxRate: 0,
        unitOfMeasure: 'EA',
      },
    ]);
  };

  // Line item modifications
  const updateLine = (key: number, patch: Partial<CounterLineItem>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const removeLine = (key: number) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  // Calculate Totals using canonical shared computeLinePrice
  const { subtotal, totalDiscount, totalTax, grandTotal } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    let tax = 0;

    for (const line of lines) {
      if (line.lineType === LineType.COMMENT) continue;
      const qty = parseFloat(line.quantity || '0');
      const price = parseFloat(line.pricePerUnit || '0');
      const discPct = Math.min(100, Math.max(0, parseFloat(line.discountPercentage || '0')));
      const selectedCat = taxCategories.find((c) => c.taxCategoryId === line.taxCategoryId);
      const rate = selectedCat ? parseFloat(selectedCat.rate || '0') : (line.taxRate || 0);

      const pricing = computeLinePrice({
        quantity: qty,
        pricePerUnit: price,
        discountPercentage: discPct,
        taxRate: rate,
      });

      const lineGross = qty * price;
      const lineDisc = lineGross - pricing.amount;

      sub += lineGross;
      disc += lineDisc;
      tax += pricing.tax;
    }

    const total = sub - disc + tax;
    return {
      subtotal: Number(sub.toFixed(2)),
      totalDiscount: Number(disc.toFixed(2)),
      totalTax: Number(tax.toFixed(2)),
      grandTotal: Number(total.toFixed(2)),
    };
  }, [lines, taxCategories]);

  // Handle Document PDF Generation & Printing
  const handlePrintPdf = useCallback(
    async (
      hookSlug: string,
      id: string,
      context: string,
      fallbackTitle: string,
    ) => {
      try {
        const response = await api.pdfTemplatesControllerRunHook(
          hookSlug,
          {},
          { id, context } as unknown as api.PdfTemplatesControllerRunHookParams,
        );
        const blob = new Blob([response.data as BlobPart], {
          type: 'application/pdf',
        });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (err: unknown) {
        reportError(err, `CounterSale:print:${hookSlug}`);
        toast.error(`Failed to print ${fallbackTitle}: ` + getErrorMessage(err));
      }
    },
    [],
  );

  // Execute 3-Step Counter Sale: Order -> OTC Fulfill -> Invoice -> (Payment)
  const handleCompleteSale = async () => {
    if (!selectedCustomer?.customerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (!selectedLocationId) {
      toast.error('Please select a counter fulfillment location.');
      return;
    }
    if (lines.length === 0) {
      toast.error('Please add at least one product line.');
      return;
    }
    if (tenderType === 'cash' && !glSettings?.defaultOtcCashAccountId) {
      toast.error(
        'Cannot process counter sale: Default OTC Cash Account is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
      );
      return;
    }
    if ((tenderType === 'card' || tenderType === 'direct_deposit') && !glSettings?.defaultOtcCardAccountId) {
      toast.error(
        'Cannot process counter sale: Default OTC Card / EFTPOS Account is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
      );
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('Creating sales order...');

    try {
      const finalNotes = orderNotes.trim()
        ? orderNotes.trim()
        : isWalkIn
        ? 'Over-the-counter point-of-sale transaction (Walk-In Customer)'
        : `Over-the-counter point-of-sale transaction (${selectedCustomer.name})`;

      const loc = locations.find((l) => l.locationId === selectedLocationId);
      const orderPayload: api.CreateOrderDto = {
        salesOrderId: crypto.randomUUID(),
        customerId: selectedCustomer.customerId,
        fulfillmentLocationId: selectedLocationId,
        notes: finalNotes,
        deliveryName: selectedCustomer.name || 'Walk-In Customer',
        deliveryAddressLine1: 'Over-the-counter collection',
        deliveryCity: loc?.name || 'Counter Pickup',
        lines: lines.map((l) => ({
          lineType: l.lineType as api.CreateOrderLineDtoLineType,
          productId: l.productId || (l.lineType === LineType.COMMENT ? undefined : CUSTOM_LINE_ID),
          productDescription: l.productDescription,
          quantity: l.lineType === LineType.COMMENT ? '0' : l.quantity,
          pricePerUnit: l.lineType === LineType.COMMENT ? '0' : l.pricePerUnit,
          discountPercentage: l.discountPercentage,
          taxCategoryId: l.taxCategoryId || undefined,
          unitOfMeasure: l.unitOfMeasure,
          fulfillmentLocationId: selectedLocationId,
        })),
      };

      const createOrderRes = await api.ordersControllerCreate(orderPayload);
      const createdOrder = createOrderRes.data as unknown as { salesOrderId?: string; id?: string; orderNumber: string };
      const orderId = (createdOrder.salesOrderId || createdOrder.id) as string;
      const orderNumber = createdOrder.orderNumber;

      // Transition Order: Draft -> Quoted -> Confirmed
      setSubmissionStep('Confirming order...');
      await api.ordersControllerChangeState(orderId, {
        stateCode: SALES_ORDER_STATE.QUOTED,
      } as api.ChangeOrderStateDto);

      await api.ordersControllerChangeState(orderId, {
        stateCode: SALES_ORDER_STATE.CONFIRMED,
        discrepanciesAcknowledged: true,
      } as api.ChangeOrderStateDto);

      // --- STEP 2: OVER-THE-COUNTER FULFILLMENT ---
      setSubmissionStep('Fulfilling stock over the counter...');
      await api.ordersControllerFulfillCounterOrder(orderId, {
        notes: 'Over-the-counter direct handover',
        allowPartialFulfillment: true,
      } as unknown as api.FulfillCounterOrderDto);

      // --- STEP 3: CREATE INVOICE ---
      setSubmissionStep('Generating tax invoice...');
      const invoiceRes = await api.salesInvoiceControllerCreateSalesInvoice(orderId, {});
      const createdInvoice = invoiceRes.data as unknown as { invoiceId?: string; id?: string; invoiceNumber: string };
      const invoiceId = (createdInvoice.invoiceId || createdInvoice.id) as string;
      const invoiceNumber = createdInvoice.invoiceNumber;

      // --- STEP 4: RECORD PAYMENT (IF TENDERED) ---
      let paymentId: string | undefined;
      let paymentNumber: string | undefined;
      let paymentFailed = false;
      if (tenderType === 'cash' || tenderType === 'card' || tenderType === 'direct_deposit') {
        setSubmissionStep('Recording payment...');
        try {
          let targetGlAccountId: string | undefined;

          if (tenderType === 'cash') {
            targetGlAccountId = glSettings?.defaultOtcCashAccountId || undefined;
          } else if (tenderType === 'card' || tenderType === 'direct_deposit') {
            targetGlAccountId = glSettings?.defaultOtcCardAccountId || undefined;
          }

          const modeOfPaymentMap: Record<string, 'Cash' | 'Credit Card' | 'EFT'> = {
            cash: 'Cash',
            card: 'Credit Card',
            direct_deposit: 'EFT',
          };

          const newPaymentId = crypto.randomUUID();
          const paymentPayload = {
            paymentId: newPaymentId,
            paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
            partyId: selectedCustomer.customerId,
            paymentDate: new Date().toISOString(),
            modeOfPayment: modeOfPaymentMap[tenderType] || 'Cash',
            totalAmount: parseFloat(grandTotal.toFixed(2)),
            glAccountBank: targetGlAccountId,
            currencyCode: baseCurrency || 'AUD',
            referenceNumber: `OTC-${orderNumber}`,
            submitImmediately: true,
            allocations: [
              {
                referenceType: 'sales_invoice',
                referenceId: invoiceId,
                allocatedAmount: parseFloat(grandTotal.toFixed(2)),
              },
            ],
          };

          const paymentRes = await api.paymentsControllerCreate(
            paymentPayload as unknown as api.CreatePaymentDto,
          );
          const pmtData = paymentRes.data as unknown as { paymentId?: string; paymentNumber?: string };
          paymentId = pmtData?.paymentId || newPaymentId;
          paymentNumber = pmtData?.paymentNumber;
        } catch (pmtErr) {
          paymentFailed = true;
          reportError(pmtErr, 'CounterSale:recordPayment');
          toast.error('Payment recording failed: ' + getErrorMessage(pmtErr));
        }
      }

      if (!paymentFailed) {
        toast.success(`Counter sale ${orderNumber} completed successfully!`);
      }

      setCompletedSale({
        orderId,
        orderNumber,
        invoiceId,
        invoiceNumber,
        paymentId,
        paymentNumber,
        totalAmount: grandTotal,
        tenderType,
      });
    } catch (err) {
      toast.error('Counter Sale failed: ' + getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  // Reset Station for New Sale
  const handleResetForNewSale = () => {
    setLines([]);
    setOrderNotes('');
    setTenderType('cash');
    setFeedback(null);
    setCompletedSale(null);
    setSelectedCustomer({
      customerId: defaultCustomerId || SYSTEM_WALK_IN_CUSTOMER_ID,
      customerNumber: SYSTEM_WALK_IN_CUSTOMER_NUMBER,
      name: SYSTEM_WALK_IN_CUSTOMER_NAME,
      customerDiscount: '0',
    });
  };



  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('title')}
          isSaving={isSubmitting}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {t('fulfillmentLocation')}:
                </span>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[180px]"
                >
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetForNewSale}
                disabled={isSubmitting}
              >
                {tCommon('buttons.clear')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCompleteSale}
                disabled={isSubmitting || lines.length === 0 || !selectedCustomer}
                className="font-bold"
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs mr-1.5" />
                    {submissionStep || t('tender.processing')}
                  </>
                ) : (
                  t('tender.completeSale')
                )}
              </Button>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        {/* Customer & Notes Selection Card */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">receipt_long</span>
            {tSales('orderDetails')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('customer')}
              </label>
              <CustomerSelect
                value={selectedCustomer?.customerId || null}
                initialSearchTerm={
                  selectedCustomer?.name === 'Walk-In Customer'
                    ? 'Walk-In Customer'
                    : selectedCustomer
                    ? `${selectedCustomer.customerNumber} — ${selectedCustomer.name}`
                    : 'Walk-In Customer'
                }
                onChange={(cust) => setSelectedCustomer(cust)}
                allowWalkIn
                walkInCustomerId={defaultCustomerId}
                placeholder={t('selectCustomer')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('notes')}
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder={t('notesPlaceholder')}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Barcode Scanner Card */}
        <BarcodeScannerCard<CounterProduct>
          placeholder={t('scanPlaceholder')}
          isProcessing={isProcessing}
          feedback={feedback}
          onScan={handleDirectBarcodeScan}
          onSearch={handleSearchProducts}
          onSelectResult={handleSelectProductResult}
        />

        {/* Standard Order Lines Card */}
        <div className="card">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="section-heading !mb-0 shrink-0">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined">list</span>
              {tSales('tabs.lines')}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={addCustomLine}
                className="text-xs font-medium py-1 px-2.5"
              >
                {tSales('buttons.customLine')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={addCommentLine}
                className="text-xs font-medium py-1 px-2.5"
              >
                {tSales('buttons.commentLine')}
              </Button>
              {lines.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setLines([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium py-1 px-2.5 ml-1"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          <OrderLinesTable<CounterLineItem>
            lines={lines}
            currencyCode={baseCurrency}
            taxCategories={taxCategories as unknown as import('@/components/shared/OrderLinesTable').TaxCategory[]}
            mode="counter"
            isEditable={true}
            subtotal={subtotal}
            totalDiscount={totalDiscount}
            totalTax={totalTax}
            grandTotal={grandTotal}
            onUpdateLine={(key, field, val) => updateLine(Number(key), { [field]: val })}
            onUpdateLineFields={(key, fields) => updateLine(Number(key), fields)}
            onRemoveLine={(key) => removeLine(Number(key))}
          />
        </div>

        {/* Payment Method Card */}
        <div className="card">
          <label className="block text-xs font-medium mb-2 text-[var(--text-muted)]">
            {t('tender.paymentMethod')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={tenderType === 'cash' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTenderType('cash')}
              className="flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">attach_money</span>
              {t('tender.cash')}
            </Button>

            <Button
              variant={tenderType === 'card' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTenderType('card')}
              className="flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">credit_card</span>
              {t('tender.card')}
            </Button>

            <Button
              variant={tenderType === 'account' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTenderType('account')}
              disabled={isWalkIn}
              className={`flex items-center gap-1 ${
                isWalkIn ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
              {t('tender.chargeToAccount')}
            </Button>

            <Button
              variant={tenderType === 'direct_deposit' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTenderType('direct_deposit')}
              className="flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              {t('tender.directDeposit')}
            </Button>
          </div>
        </div>
      </div>

      {/* Completion & Receipt Modal (Flat, Clean, No Shadows) */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative bg-[var(--bg-card)] w-full max-w-lg rounded-2xl border border-[var(--border)] p-6 flex flex-col gap-5">
            {/* Close Cross Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleResetForNewSale}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Button>

            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4 pr-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {t('receiptModal.title')}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  All inventory deducted, invoice generated, and accounts balanced.
                </p>
              </div>
            </div>

            {/* Entity Details (No grey background, direct links & icon-based print buttons) */}
            <div className="space-y-3 py-1 font-mono text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)] font-sans text-xs">
                  {t('receiptModal.orderNumber')}:
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sales-orders/${completedSale.orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[var(--accent)] hover:underline"
                  >
                    {completedSale.orderNumber}
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() =>
                      handlePrintPdf(
                        'sales-order-confirmation',
                        completedSale.orderId,
                        DATA_SOURCE_CONTEXT.SALES_ORDER,
                        'Sales Order',
                      )
                    }
                    className="p-1 h-7 w-7"
                    title="Print Sales Order"
                    aria-label="Print Sales Order"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)] font-sans text-xs">
                  {t('receiptModal.invoiceNumber')}:
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sales-invoices/${completedSale.invoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                  >
                    {completedSale.invoiceNumber}
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() =>
                      handlePrintPdf(
                        'sales-invoice',
                        completedSale.invoiceId,
                        DATA_SOURCE_CONTEXT.SALES_INVOICE,
                        'Tax Invoice',
                      )
                    }
                    className="p-1 h-7 w-7"
                    title="Print Tax Invoice"
                    aria-label="Print Tax Invoice"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                  </Button>
                </div>
              </div>

              {completedSale.paymentId && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-muted)] font-sans text-xs">
                    {t('receiptModal.paymentReference')}:
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/payments?payment=${completedSale.paymentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                    >
                      {completedSale.paymentNumber || t('receiptModal.paymentReference')}
                    </Link>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() =>
                        handlePrintPdf(
                          'customer-payment-receipt',
                          completedSale.paymentId!,
                          DATA_SOURCE_CONTEXT.CUSTOMER_PAYMENT_RECEIPT,
                          'Payment Receipt',
                        )
                      }
                      className="p-1 h-7 w-7"
                      title="Print Payment Receipt"
                      aria-label="Print Payment Receipt"
                    >
                      <span className="material-symbols-outlined text-[16px]">print</span>
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <span className="text-[var(--text-muted)] font-sans text-xs">
                  {completedSale.tenderType === 'account'
                    ? t('tender.chargeToAccount')
                    : t('receiptModal.amountPaid')}
                  :
                </span>
                <span className="font-bold text-[var(--text-primary)] text-base">
                  {formatAmount(completedSale.totalAmount, baseCurrency)}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={handleResetForNewSale}
                className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {t('receiptModal.newSale')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DetailsLayout>
  );
}
