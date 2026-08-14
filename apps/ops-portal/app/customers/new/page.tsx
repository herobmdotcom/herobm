'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useTranslations } from 'next-intl';
import { CURRENCIES } from '@/lib/currency';
import GroupSelect from '@/components/shared/GroupSelect';
import CustomerSelect from '@/components/shared/CustomerSelect';
import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import { ActorCard } from '@/components/shared/ActorCard';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from '@/components/shared/InheritedSelect';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useGroup, useInheritance } from '@/hooks/useInheritance';
import { Button } from '@/components/shared/Button';

export default function NewAccountPage() {
  useDocumentTitle('New Customer');
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { baseCurrency, organization, app } = useSettings();
  
  const defaultCountry = organization?.country || '';
  const defaultCurrency = getCurrencyForCountry(defaultCountry) || baseCurrency || 'EUR';

  const [submitting, setSubmitting] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [dto, setDto] = useState({
    actorId: '',
    customerNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    billingAddressCountry: defaultCountry,
    customerGroupId: '',
    taxPositionId: '',
    currencyCode: defaultCurrency,
    customerDiscount: '0',
    notes: '',
    parentCustomerId: '',
    businessNumber: '',
    isTaxRegistered: false,
    tradingTermsId: '',
    creditLimit: '',
    isOnCreditHold: null as boolean | null,
    earlyPaymentDiscount: '',
    earlyPaymentDiscountDays: '',
  });
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [customerGroups, setCustomerGroups] = useState<api.CustomerGroupResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
    api.customerGroupsControllerFindAll().then((res: unknown) => setCustomerGroups((res as { data: unknown[] }).data as unknown as api.CustomerGroupResponseDto[])).catch(console.error);
    api.tradingTermsControllerFindAll().then((res: unknown) => setTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[])).catch(console.error);
  }, []);

  const selectedGroup = useGroup(customerGroups, dto.customerGroupId);

  const creditHoldInheritance = useInheritance([
    { 
      value: selectedGroup?.isOnCreditHold === true ? 'true' : selectedGroup?.isOnCreditHold === false ? 'false' : null, 
      sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group'
    }
  ]);

  const taxPositionInheritance = useInheritance([
    { value: selectedGroup?.taxPositionId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultCustomerTaxPositionId, sourceLabel: 'System Default' }
  ]);

  const tradingTermsInheritance = useInheritance([
    { value: selectedGroup?.tradingTermsId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultCustomerTermsId, sourceLabel: 'System Default' }
  ]);

  const creditLimitInheritance = useInheritance([
    { value: selectedGroup?.creditLimit, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const earlyPaymentDiscountInheritance = useInheritance([
    { value: (selectedGroup as { earlyPaymentDiscount?: string })?.earlyPaymentDiscount, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const earlyPaymentDiscountDaysInheritance = useInheritance([
    { value: (selectedGroup as { earlyPaymentDiscountDays?: number })?.earlyPaymentDiscountDays, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const handleActorSelect = (actor: Actor | null) => {
    setSelectedActor(actor);
    if (actor) {
      setDto((prev) => ({
        ...prev,
        actorId: actor.actorId || '',
        name: actor.name || prev.name,
        businessNumber: actor.businessNumber || prev.businessNumber,
        isTaxRegistered: actor.isTaxRegistered ?? prev.isTaxRegistered,
        billingAddressCountry: actor.headquartersCountry || prev.billingAddressCountry,
      }));
    } else {
      setDto((prev) => ({
        ...prev,
        actorId: '',
        name: '',
        businessNumber: '',
        isTaxRegistered: false,
        billingAddressCountry: defaultCountry,
      }));
    }
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (payload.isOnCreditHold === null) delete payload.isOnCreditHold;
      
      if (payload.earlyPaymentDiscountDays) {
        payload.earlyPaymentDiscountDays = Number(payload.earlyPaymentDiscountDays);
      } else {
        delete payload.earlyPaymentDiscountDays;
      }
      if (!payload.earlyPaymentDiscount) {
        delete payload.earlyPaymentDiscount;
      }

      const res = await api.customersControllerCreate(payload as unknown as api.CreateCustomerDto);
      const customer = res.data;
      toast.success('Customer created');
      router.push(`/customers/${customer.customerId}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.customerNumber.trim() !== '' && dto.name.trim() !== '';

  
  
  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title={t('buttons.createCustomer')}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/customers')}
                  disabled={submitting}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting ? tCommon('saving') : t('buttons.createCustomer')}
                </Button>
              </>
            }
            showPrint={false}
          />
        }
      >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
            <div className="card">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string -- icon */}
                <span className="material-symbols-outlined">link</span>
                { }
                Link to Existing Actor (Optional)
              </h3>
              <div className="mb-4">
                <ActorSelect
                  value={dto.actorId || null}
                  onChange={handleActorSelect}
                  disabled={submitting}
                />
              </div>
              {selectedActor && (
                <div className="mt-4">
                  <ActorCard actor={selectedActor} />
                </div>
              )}
            </div>

            {/* General Info Card */}
            <div className="card">
              <h3 className="section-heading">
                { }
                { }
                <span className="material-symbols-outlined">info</span>
                {t('generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                      {t('columns.customerNumber')} *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={dto.customerNumber}
                      onChange={(e) => updateField('customerNumber', e.target.value)}
                      placeholder="e.g. ACME-001"
                      disabled={submitting}
                    />
                  </div>
                  {!selectedActor && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                        {tCommon('columns.name')} *
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={dto.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="e.g. Acme Corporation"
                        disabled={submitting}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(!selectedActor || !(selectedActor as unknown as { headquartersCountry?: string }).headquartersCountry) && (
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                        {tCommon('columns.country')} *
                      </label>
                      <select
                        className="input"
                        value={dto.billingAddressCountry}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateField('billingAddressCountry', val);
                          const newCurrency = getCurrencyForCountry(val);
                          if (newCurrency) {
                            updateField('currencyCode', newCurrency);
                          }
                        }}
                        disabled={submitting}
                      >
                        <option value="">{tCommon('notConfigured')}</option>
                        {COUNTRIES.map((c: { code: string; name: string }) => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={selectedActor ? "md:col-span-2" : ""}>
                    <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                      {tCommon('columns.currency')} *
                    </label>
                    <select
                      className="input"
                      value={dto.currencyCode}
                      onChange={(e) => updateField('currencyCode', e.target.value)}
                      disabled={submitting}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
      </div>
      </DetailsLayout>
    </>
  );

}
