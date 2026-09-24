'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import CustomerSelect, { Customer } from '@/components/shared/CustomerSelect';
import OpportunitySelect, { OpportunityOption } from '@/components/shared/OpportunitySelect';
import { useSettings } from '@/components/SettingsProvider';
import {
  getErrorMessage,
  PROJECT_BILLING_TYPE,
  ProjectBillingType,
} from '@herobm/shared';
import * as api from '@herobm/sdk';
import InheritedSelect from '@/components/shared/InheritedSelect';
import { useInheritance } from '@/hooks/useInheritance';

export default function ProjectNewClient() {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOpportunityId = searchParams.get('opportunityId') || searchParams.get('opportunity_id') || '';
  const urlCustomerId = searchParams.get('customerId') || searchParams.get('customer_id') || '';
  const { baseCurrency, app: appSettings } = useSettings();
  useDocumentTitle(t('createTitle'));

  const projectStages = (appSettings?.projectStages || []) as Array<{ value: string; order?: number }>;
  const sortedStages = useMemo(
    () => [...projectStages].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [projectStages]
  );

  // Core Form Fields
  const [projectNumber, setProjectNumber] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('');
  const [description, setDescription] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityOption | null>(null);
  const [billingType, setBillingType] = useState<ProjectBillingType>(PROJECT_BILLING_TYPE.TIME_AND_MATERIALS);
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [tradingTermsId, setTradingTermsId] = useState('');
  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.tradingTermsControllerFindAll()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setTradingTerms(res.data);
        }
      })
      .catch((err) => {
        toast.error(getErrorMessage(err));
      });
  }, []);

  const tradingTermsInheritance = useInheritance([
    {
      value: (customer as { tradingTermsId?: string | null } | null)?.tradingTermsId,
      sourceLabel: customer?.name ? `Customer (${customer.name})` : 'Customer',
    },
    {
      value: appSettings?.defaultCustomerTermsId,
      sourceLabel: 'System Default',
    },
  ]);

  useEffect(() => {
    if (urlOpportunityId) {
      api.opportunitiesControllerFindOne(urlOpportunityId)
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
            setName((prev) => prev || opp.name);
            if (opp.description) {
              setDescription((prev) => prev || opp.description || '');
            }
          }
        })
        .catch((err) => {
          toast.error(getErrorMessage(err));
        });
    }
  }, [urlOpportunityId]);

  useEffect(() => {
    if (urlCustomerId) {
      api.customersControllerFindOne(urlCustomerId)
        .then((res) => {
          if (res.data) {
            const cust = res.data as unknown as Customer;
            setCustomer(cust);
          }
        })
        .catch((err) => {
          toast.error(getErrorMessage(err));
        });
    }
  }, [urlCustomerId]);

  useEffect(() => {
    if (!stage && sortedStages.length > 0) {
      setStage(sortedStages[0].value);
    }
  }, [sortedStages, stage]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('errors.nameRequired'));
      return;
    }
    if (!customer?.customerId) {
      setError(t('errors.customerRequired'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: api.CreateProjectDto = {
        projectNumber: projectNumber.trim() || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        customerId: customer.customerId,
        opportunityId: opportunity?.opportunityId || undefined,
        stage: stage || sortedStages[0]?.value || 'Planning',
        billingType: billingType as api.CreateProjectDtoBillingType,
        currencyCode: customer.currencyCode || baseCurrency || 'USD',
        discountPercentage: discountPercentage.trim() ? parseFloat(discountPercentage.trim()) : undefined,
        tradingTermsId: tradingTermsId || undefined,
        startDate: startDate || undefined,
        targetEndDate: targetEndDate || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await api.projectsControllerCreate(payload);
      const created = res.data;

      toast.success('Project created successfully');
      router.push(`/projects/${created.projectId}`);
    } catch (err) {
      setError(getErrorMessage(err) || t('errors.failedToCreate'));
      setSubmitting(false);
    }
  };

  const displayedCurrency = customer?.currencyCode || baseCurrency || 'USD';

  return (
    <DetailsLayout
      showPrint={false}
      header={
        <EntityHeader
          title={t('createTitle')}
          isSaving={submitting}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/projects')}
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
                  t('buttons.createProject')
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
        {/* Project Details Card */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">receipt_long</span>
            {t('detailsHeading')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer selector */}
            <div className="relative">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.customer')} *
                {customer && (
                  <span className="ml-2 px-1.5 py-px rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wider">
                    {displayedCurrency}
                  </span>
                )}
              </label>
              <CustomerSelect
                value={customer?.customerId || null}
                initialSearchTerm={
                  customer
                    ? customer.name
                      ? `${customer.customerNumber ? `${customer.customerNumber} — ` : ''}${customer.name}`
                      : customer.customerNumber
                    : ''
                }
                onChange={setCustomer}
                placeholder={t('placeholders.searchCustomers')}
                required
              />
            </div>

            {/* Project Code */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.projectCode')}
              </label>
              <input
                id="project-code"
                className="input w-full font-mono"
                placeholder={t('placeholders.projectCode')}
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
              />
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.name')} *
              </label>
              <input
                id="project-name"
                className="input w-full"
                placeholder={t('placeholders.projectName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Delivery Stage */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.stage')}
              </label>
              <select
                id="project-stage"
                className="input w-full"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {sortedStages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.value}
                  </option>
                ))}
              </select>
            </div>

            {/* CRM Opportunity */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.opportunity')}
              </label>
              <OpportunitySelect
                value={opportunity?.opportunityId || null}
                initialSearchTerm={opportunity?.name || ''}
                onChange={setOpportunity}
                placeholder={t('placeholders.opportunity')}
              />
            </div>

            {/* Billing Type */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.billingType')} *
              </label>
              <select
                id="project-billing-type"
                className="input w-full"
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as ProjectBillingType)}
              >
                <option value={PROJECT_BILLING_TYPE.TIME_AND_MATERIALS}>Time & Materials</option>
                <option value={PROJECT_BILLING_TYPE.FIXED_PRICE}>Fixed Price</option>
                <option value={PROJECT_BILLING_TYPE.MILESTONE}>Milestone Based</option>
                <option value={PROJECT_BILLING_TYPE.COST_PLUS}>Cost Plus</option>
              </select>
            </div>

            {/* Discount Percentage */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Headline Discount %
              </label>
              <div className="relative">
                <input
                  id="project-discount-percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="input w-full pr-8"
                  placeholder="Inherit from Customer"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  %
                </span>
              </div>
            </div>
            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.paymentTerms')}
              </label>
              <InheritedSelect
                className="input w-full"
                value={tradingTermsId}
                onChange={setTradingTermsId}
                options={tradingTerms.map((term) => ({
                  value: term.tradingTermsId,
                  label: `${term.code} - ${term.description}`,
                }))}
                inheritedValue={tradingTermsInheritance.inheritedValue}
                inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.startDate')}
              </label>
              <input
                id="project-start-date"
                type="date"
                className="input w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Target End Date */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.endDate')}
              </label>
              <input
                id="project-end-date"
                type="date"
                className="input w-full"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {t('labels.description')}
              </label>
              <textarea
                id="project-description"
                className="input w-full min-h-[80px] pt-3 resize-y"
                placeholder={t('placeholders.description')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Internal Notes */}
            <div className="md:col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tCommon('notesCardHeading')}
              </label>
              <textarea
                id="project-notes"
                className="input w-full min-h-[80px] pt-3 resize-y"
                placeholder={tCommon('notesCardPlaceholder')}
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

