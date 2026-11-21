'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { parseInitialPhone, toSupportedCountry } from '@/lib/phone';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import { Button } from '@/components/shared/Button';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import CustomerSelect from '@/components/shared/CustomerSelect';
import OpportunitySelect, { OpportunityOption } from '@/components/shared/OpportunitySelect';
import DeliveryAddressSlideOver from '@/components/shared/DeliveryAddressSlideOver';
import { getErrorMessage } from '@herobm/shared';
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

export default function NewOrderPage() {
  const { app } = useSettings();
  useDocumentTitle('New Sales Order');
  const tSales = useTranslations('salesOrders');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOpportunityId = searchParams.get('opportunityId') || searchParams.get('projectId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [opportunityId, setOpportunityId] = useState(initialOpportunityId);
  const [opportunity, setOpportunity] = useState<OpportunityOption | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerDiscount, setCustomerDiscount] = useState('0');
  const [currencyCode, setCurrencyCode] = useState('');
  const [customerTaxPosition, setCustomerTaxPosition] = useState<string | null>(null);
  const [customerCountry, setCustomerCountry] = useState<string | undefined>(undefined);

  const [name, setName] = useState('');
  const [customerOrderNumber, setCustomerOrderNumber] = useState('');
  const [analysisCode, setAnalysisCode] = useState('');
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

  const [locations, setLocations] = useState<Location[]>([]);
  const [fulfillmentLocationId, setFulfillmentLocationId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isCustomerExempt = customerTaxPosition?.toLowerCase() === 'exempt';

  // Load locations on mount
  useEffect(() => {
    api.inventoryControllerFindAllLocations({})
      .then((res) => {
        const payload = res.data || [];
        setLocations(payload);
        if (payload.length > 0) {
          setFulfillmentLocationId((payload[0]).locationId);
        }
      })
      .catch((err) => reportError(err, 'NewOrderPage_Locations'));
  }, []);

  // Pre-load opportunity if ID is present
  useEffect(() => {
    if (initialOpportunityId) {
      api.opportunitiesControllerFindOne(initialOpportunityId)
        .then((res) => {
          if (res.data) {
            const opp = res.data;
            setOpportunity({
              opportunityId: opp.opportunityId,
              name: opp.name,
              status: opp.status,
              estimatedValue: opp.estimatedValue ? Number(opp.estimatedValue) : undefined,
              currencyCode: opp.currencyCode,
            });
            setOpportunityId(opp.opportunityId);
            if (opp.customerId && !customerId) {
              api.customersControllerFindOne(opp.customerId)
                .then((cRes) => {
                  if (cRes.data) {
                    selectCustomer(cRes.data as unknown as Customer);
                  }
                })
                .catch((cErr) => reportError(cErr, 'NewOrderPage_OppCustomer'));
            }
          }
        })
        .catch((err) => {
          toast.error(getErrorMessage(err));
        });
    }
  }, [initialOpportunityId]);

  const selectCustomer = (a: Customer) => {
    setCustomerId(a.customerId);
    setCustomerName(a.name || '');
    setCurrencyCode(a.currencyCode || '');
    setCustomerDiscount(a.customerDiscount || '0');
    setCustomerTaxPosition(a.taxPosition ?? a.gstCategoryName ?? null);

    api.customersControllerFindOne(a.customerId)
      .then((res) => {
        const customer = res.data as unknown as Customer;
        setCustomerDeliveryAddresses((customer.deliveryAddresses as unknown as api.DeliveryAddressResponseDto[]) || []);
        setCustomerCountry(customer.billingAddressCountry || undefined);
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
  };

  // Pre-load customer if ID is present in query parameters
  useEffect(() => {
    if (initialCustomerId) {
      api.customersControllerFindOne(initialCustomerId)
        .then((res) => {
          if (res.data) {
            selectCustomer(res.data as unknown as Customer);
          }
        })
        .catch((err) => {
          reportError(err, 'NewOrderPage_InitialCustomer');
        });
    }
  }, [initialCustomerId]);

  const handleSubmit = async () => {
    if (!customerId) {
      setError(tCommon('errors.pleaseSelectCustomer'));
      return;
    }
    if (!currencyCode) {
      setError(tSales('errors.noCurrency'));
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
        opportunityId: opportunityId || undefined,
        customFields: analysisCode ? { analysisCode } : undefined,
        lines: [],
      });
      const order = orderRes.data;
      router.push(`/sales-orders/${order.salesOrderId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tCommon('errors.failedToCreateOrder'));
      setSubmitting(false);
    }
  };

  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title={tSales('createTitle')}
            isSaving={submitting}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/sales-orders')}
                  disabled={submitting}
                >
                  {tCommon('cancel')}
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
                      {tCommon('saving')}
                    </>
                  ) : (
                    tSales('buttons.createOrder')
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

        <div className="flex flex-col gap-4">
          {/* Order Header / Customer Selection */}
          <div className="card">
            <h3 className="section-heading">
              <span className="material-symbols-outlined">receipt_long</span>
              {tSales('orderDetails')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer selector */}
              <div className="relative">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSales('labels.customer')} *
                  {customerId && (
                    <span className="ml-2 px-1.5 py-px rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wider">
                      {currencyCode}
                    </span>
                  )}
                  {isCustomerExempt && (
                    <span className="ml-1 px-1.5 py-px rounded bg-amber-500/15 text-amber-500 font-semibold text-[10px] tracking-wider">
                      {tCommon('taxLabels.exempt')}
                    </span>
                  )}
                  {customerId && parseFloat(customerDiscount) > 0 && (
                    <span className="ml-1 px-1.5 py-px rounded bg-green-500/15 text-green-400 font-semibold text-[10px] tracking-wider">
                      {tSales('discountPercent', { disc: parseFloat(customerDiscount) })}
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
                      setCustomerName('');
                      setCurrencyCode('');
                      setCustomerDiscount('0');
                      setCustomerTaxPosition(null);
                    }
                  }}
                  placeholder={tSales('placeholders.searchCustomers')}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSales('labels.customerPO')}
                </label>
                <input
                  id="order-po"
                  className="input"
                  placeholder={tSales('placeholders.customerPO')}
                  value={customerOrderNumber}
                  onChange={(e) => setCustomerOrderNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSales('labels.orderName')}
                </label>
                <input
                  id="order-name"
                  className="input"
                  placeholder={tSales('placeholders.orderName')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tSales('labels.fulfillmentLocation')}
                </label>
                <select
                  className="input w-full"
                  value={fulfillmentLocationId}
                  onChange={(e) => setFulfillmentLocationId(e.target.value)}
                >
                  {locations.length === 0 && <option value="" disabled>{tCommon('loadingEllipsis')}</option>}
                  {locations.map((loc) => (
                    <option key={loc.locationId} value={loc.locationId}>
                      {formatLocationDisplay(loc)}
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  CRM Opportunity
                </label>
                <OpportunitySelect
                  value={opportunity?.opportunityId || opportunityId || null}
                  initialSearchTerm={opportunity?.name || ''}
                  onChange={(opp) => {
                    setOpportunity(opp);
                    setOpportunityId(opp?.opportunityId || '');
                  }}
                  placeholder="Search or select an opportunity..."
                />
              </div>

              <div className="md:col-span-2 mt-2">
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {tCommon('notesCardHeading')}
                </label>
                <textarea
                  id="order-notes"
                  className="input w-full min-h-[80px] pt-3 resize-y"
                  placeholder={tCommon('notesCardPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Delivery section */}
          <div className="card">
            <h3 className="section-heading mb-4">
              <span className="material-symbols-outlined">local_shipping</span>
              {tSales('tabs.delivery')}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div className="flex flex-col gap-4">
                <div className="mt-2">
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
                        defaultCountry={toSupportedCountry(customerCountry)}
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
