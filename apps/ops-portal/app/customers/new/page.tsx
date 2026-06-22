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
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from '@/components/shared/InheritedSelect';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useGroup, useInheritance } from '@/hooks/useInheritance';

export default function NewAccountPage() {
  useDocumentTitle('New Customer');
  const t = useTranslations();
  const tCommon = useTranslations('admin.common');
  const router = useRouter();
  const { baseCurrency, organization, app } = useSettings();
  
  const defaultCountry = organization?.country || '';
  const defaultCurrency = getCurrencyForCountry(defaultCountry) || baseCurrency || 'EUR';

  const [submitting, setSubmitting] = useState(false);
  const [dto, setDto] = useState({
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
  });
  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [customerGroups, setCustomerGroups] = useState<api.AccountGroupResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
    api.accountGroupsControllerFindAll().then((res: unknown) => setCustomerGroups((res as { data: unknown[] }).data as unknown as api.AccountGroupResponseDto[])).catch(console.error);
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

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (payload.isOnCreditHold === null) delete payload.isOnCreditHold;

      const res = await api.accountsControllerCreate(payload as unknown as api.CreateAccountDto);
      const customer = res.data;
      toast.success(t('toast.accountCreated'));
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
        header={
          <EntityHeader
            title={t('customers.buttons.createCustomer')}
            onBack={() => router.push('/customers')}
            actions={
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push('/customers')}
                  disabled={submitting}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting ? t('common.saving') : t('customers.buttons.createCustomer')}
                </button>
              </>
            }
            showPrint={false}
          />
        }
      >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
            {/* General Info Card */}
            <div className="card">
              <h3 className="section-heading">
                { }
                <span className="material-symbols-outlined">info</span>
                {t('customers.generalInfo')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.columns.customerNumber')} *
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
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.name')} *
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.placeholders.customerGroup')}
                    </label>
                    <GroupSelect
                      type="customer"
                      value={dto.customerGroupId || null}
                      onChange={(val) => updateField('customerGroupId', val || '')}
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('customers.fields.parentCustomer')}
                    </label>
                    <CustomerSelect
                      value={dto.parentCustomerId || null}
                      onChange={(val) => updateField('parentCustomerId', val?.customerId || '')}
                      disabled={submitting}
                      excludeId={null}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.columns.country')} *
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
                      <option value="">{t('common.notConfigured')}</option>
                      {COUNTRIES.map((c: { code: string; name: string }) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('common.notesCardHeading')}
                    </label>
                    <input
                      type="text"
                      className="input w-full"
                      value={dto.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder={t('common.notesCardPlaceholder')}
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing & Currency Card */}
            <div className="card">
              <h3 className="section-heading">
                { }
              <span className="material-symbols-outlined">payments</span>
              FINANCIALS
            </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.currency')} *
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
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.columns.discountPct')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="input"
                    value={dto.customerDiscount || '0'}
                    onChange={(e) => updateField('customerDiscount', e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('common.columns.taxPosition')}
                  </label>
                  <InheritedSelect
                    className="input"
                    value={dto.taxPositionId || ''}
                    onChange={(val) => updateField('taxPositionId', val)}
                    disabled={submitting}
                    options={taxPositions.map((pos) => ({
                      value: pos.taxPositionId,
                      label: pos.title,
                    }))}
                    inheritedValue={taxPositionInheritance.inheritedValue}
                    inheritedSourceLabel={taxPositionInheritance.inheritedSourceLabel}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Trading Terms
                  </label>
                  <InheritedSelect
                    className="input"
                    value={dto.tradingTermsId || ''}
                    onChange={(val) => updateField('tradingTermsId', val)}
                    disabled={submitting}
                    options={tradingTerms.map((term) => ({
                      value: term.id,
                      label: term.description,
                    }))}
                    inheritedValue={tradingTermsInheritance.inheritedValue}
                    inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Credit Limit
                  </label>
                  <div className="flex items-center gap-3">
                    <InheritedNumberInput
                      step="0.01"
                      className="input w-full max-w-xs"
                      value={dto.creditLimit || ""}
                      onChange={(val) => updateField("creditLimit", val)}
                      disabled={submitting}
                      placeholder="0.00"
                      inheritedValue={creditLimitInheritance.inheritedValue}
                      inheritedSourceLabel={creditLimitInheritance.inheritedSourceLabel}
                    />
                    {!!creditLimitInheritance.inheritedSourceLabel && (
                      <span className="text-xs italic text-[var(--primary)] ml-2 flex-shrink-0">
                        {t('common.options.inheritValue', {
                          label: creditLimitInheritance.inheritedValue || '',
                          source: creditLimitInheritance.inheritedSourceLabel || ''
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Credit Hold
                  </label>
                  <InheritedSelect
                    className="input"
                    disabled={submitting}
                    value={dto.isOnCreditHold === true ? 'true' : dto.isOnCreditHold === false ? 'false' : ''}
                    onChange={(val) => {
                      const boolVal = val === 'true' ? true : val === 'false' ? false : null;
                      updateField("isOnCreditHold", boolVal);
                    }}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' }
                    ]}
                    inheritedValue={creditHoldInheritance.inheritedValue}
                    inheritedSourceLabel={creditHoldInheritance.inheritedSourceLabel}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.fields.businessNumber')}
                    <FrontendEnrichmentDecorator
                      field="customer.business_number"
                      country={dto.billingAddressCountry || ''}
                      value={dto.businessNumber}
                      isSaving={submitting}
                      onEnrich={(data) => {
                        if (data.name && data.name !== dto.name) {
                          updateField('name', data.name);
                          toast.success(t('enrichment.nameUpdated'));
                        }
                        if (data.isTaxRegistered !== undefined && data.isTaxRegistered !== dto.isTaxRegistered) {
                          updateField('isTaxRegistered', data.isTaxRegistered);
                          toast.success(t('enrichment.taxUpdated'));
                        }
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    value={dto.businessNumber}
                    onChange={(e) => updateField('businessNumber', e.target.value)}
                    disabled={submitting}
                    placeholder="Enter business number..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('customers.fields.taxRegistered')}
                  </label>
                  <div
                    className="flex items-center gap-3"
                    style={{ paddingTop: 6, cursor: submitting ? 'not-allowed' : 'pointer' }}
                    onClick={() => {
                      if (submitting) return;
                      updateField('isTaxRegistered', !dto.isTaxRegistered);
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        background: dto.isTaxRegistered ? 'var(--accent)' : 'var(--border)',
                        position: 'relative',
                        transition: 'background 0.2s ease',
                        opacity: submitting ? 0.5 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 3,
                          left: dto.isTaxRegistered ? 21 : 3,
                          transition: 'left 0.2s ease',
                        }}
                      />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {dto.isTaxRegistered ? tCommon('yes') : tCommon('no')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
      </div>
      </DetailsLayout>
    </>
  );

}
