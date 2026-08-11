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
import ActorSelect, { Actor } from '@/components/shared/ActorSelect';
import { ActorCard } from '@/components/shared/ActorCard';
import { useSettings } from '@/components/SettingsProvider';
import InheritedSelect from '@/components/shared/InheritedSelect';
import { FrontendEnrichmentDecorator } from '@/components/shared/FrontendEnrichmentDecorator';
import { getErrorMessage, COUNTRIES, getCurrencyForCountry } from '@herobm/shared';
import InheritedNumberInput from '@/components/shared/InheritedNumberInput';
import { useGroup, useInheritance } from '@/hooks/useInheritance';

export default function NewSupplierPage() {
  const { baseCurrency, organization, app } = useSettings();
  const t = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('new.documentTitle'));
  const router = useRouter();

  const defaultCountry = organization?.country || '';
  const defaultCurrency = getCurrencyForCountry(defaultCountry) || baseCurrency || 'EUR';

  const [submitting, setSubmitting] = useState(false);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [dto, setDto] = useState({
    actorId: '',
    vendorNumber: '',
    name: '',
    emailAddress1: '',
    telephone1: '',
    address1Line1: '',
    address1City: '',
    address1Country: defaultCountry,
    currencyCode: defaultCurrency,
    supplierGroupId: '',
    notes: '',
    bankAccountName: '',
    bankBsb: '',
    bankAccountNumber: '',
    businessNumber: '',
    isTaxRegistered: false,
    taxPositionId: '',
    tradingTermsId: '',
    earlyPaymentDiscount: '',
    earlyPaymentDiscountDays: '',
    creditLimit: '',
    isPurchasingBlocked: null as boolean | null,
    isPaymentBlocked: null as boolean | null,
  });

  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [supplierGroups, setSupplierGroups] = useState<api.SupplierGroupResponseDto[]>([]);
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);

  useEffect(() => {
    api.taxPositionsControllerFindAll().then((res: unknown) => setTaxPositions((res as { data: unknown[] }).data as unknown as api.TaxPositionResponseDto[])).catch(console.error);
    api.supplierGroupsControllerFindAll().then((res: unknown) => setSupplierGroups((res as { data: unknown[] }).data as unknown as api.SupplierGroupResponseDto[])).catch(console.error);
    api.tradingTermsControllerFindAll().then((res: unknown) => setTradingTerms((res as { data: unknown[] }).data as unknown as api.TradingTermResponseDto[])).catch(console.error);
  }, []);
  const selectedGroup = useGroup(supplierGroups, dto.supplierGroupId);

  const earlyPaymentDiscountInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscount, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const earlyPaymentDiscountDaysInheritance = useInheritance([
    { value: selectedGroup?.earlyPaymentDiscountDays, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const creditLimitInheritance = useInheritance([
    { value: selectedGroup?.creditLimit, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const taxPositionInheritance = useInheritance([
    { value: selectedGroup?.taxPositionId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTaxPositionId, sourceLabel: 'System Default' }
  ]);

  const tradingTermsInheritance = useInheritance([
    { value: selectedGroup?.tradingTermsId, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' },
    { value: app?.defaultSupplierTermsId, sourceLabel: 'System Default' }
  ]);

  const purchasingBlockInheritance = useInheritance([
    { value: selectedGroup?.isPurchasingBlocked === true ? 'true' : selectedGroup?.isPurchasingBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
  ]);

  const paymentBlockInheritance = useInheritance([
    { value: selectedGroup?.isPaymentBlocked === true ? 'true' : selectedGroup?.isPaymentBlocked === false ? 'false' : null, sourceLabel: selectedGroup?.groupCode ? `Group ${selectedGroup.groupCode}` : 'Group' }
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
        address1Country: actor.headquartersCountry || prev.address1Country,
      }));
    } else {
      setDto((prev) => ({
        ...prev,
        actorId: '',
        name: '',
        businessNumber: '',
        isTaxRegistered: false,
        address1Country: defaultCountry,
      }));
    }
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = { ...dto };
      if (!payload.purchaseTaxCategoryId) delete payload.purchaseTaxCategoryId;
      if (!payload.salesTaxCategoryId) delete payload.salesTaxCategoryId;
      if (!payload.productGroupId) delete payload.productGroupId;
      if (payload.earlyPaymentDiscountDays) {
        payload.earlyPaymentDiscountDays = Number(payload.earlyPaymentDiscountDays);
      } else {
        delete payload.earlyPaymentDiscountDays;
      }
      if (payload.isPurchasingBlocked === null) delete payload.isPurchasingBlocked;
      if (payload.isPaymentBlocked === null) delete payload.isPaymentBlocked;

      const res = await api.suppliersControllerCreate(payload as unknown as api.CreateSupplierDto);
      const supplier = res.data;
      toast.success(tCommon('toast.supplierCreated'));
      router.push(`/suppliers/${(supplier as { vendorId?: string; id?: string }).vendorId || (supplier as { vendorId?: string; id?: string }).id}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const isValid = dto.vendorNumber.trim() !== '' && dto.name.trim() !== '' && dto.currencyCode !== '';
  
  return (
    <>
      <DetailsLayout
        showPrint={false}
        header={
          <EntityHeader
            title={t('buttons.createSupplier')}
            subtitle={t('management')}
            isSaving={submitting}
            showPrint={false}
          />
        }
      >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 mb-6">
        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string -- icon */}
<span className="material-symbols-outlined">link</span>
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
            <span className="material-symbols-outlined">info</span>
            {t('generalInfo')}
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('columns.vendorNumber')} *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.vendorNumber}
                  onChange={(e) => updateField('vendorNumber', e.target.value)}
                  placeholder={t('placeholders.vendorNumber')}
                  disabled={submitting}
                />
              </div>
              {!selectedActor && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('columns.name')} *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={dto.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder={t('placeholders.name')}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!selectedActor || !(selectedActor as unknown as { headquartersCountry?: string }).headquartersCountry) && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('columns.country')} *
                  </label>
                  <select
                    className="input"
                    value={dto.address1Country}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('address1Country', val);
                      const newCurrency = getCurrencyForCountry(val);
                      if (newCurrency) {
                        updateField('currencyCode', newCurrency);
                      }
                    }}
                    disabled={submitting}
                  >
                    <option value="">{tCommon('notConfigured')}</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={selectedActor ? "md:col-span-2" : ""}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('columns.currency')} *
                </label>
                <select
                  className="input"
                  value={dto.currencyCode}
                  onChange={(e) => updateField('currencyCode', e.target.value)}
                  disabled={submitting}
                >
                  <option value="" disabled>{t('fields.selectCurrency')}</option>
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

