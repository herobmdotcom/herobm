"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";

import { FrontendEnrichmentDecorator } from "@/components/shared/FrontendEnrichmentDecorator";
import { formatAmount } from "@/lib/currency";
import ActivityTimeline, { TimelineEvent } from "@/components/shared/ActivityTimeline";
import { StateName } from "@/components/StateBadge";
import { ValidState } from "@/types/states";
import GroupSelect from "@/components/shared/GroupSelect";
import * as api from "@herobm/sdk";
import { Button } from '@/components/shared/Button';
import CustomerSelect from "@/components/shared/CustomerSelect";
import DiscountMatrixSlideOver from "@/components/shared/DiscountMatrixSlideOver";
import InheritedSelect from "@/components/shared/InheritedSelect";
import InheritedNumberInput from "@/components/shared/InheritedNumberInput";
import { useInheritance, useGroup } from "@/hooks/useInheritance";
import { useSettings } from "@/components/SettingsProvider";
import {
  CURRENCIES,
  COUNTRIES,
  CUSTOMER_STATE,
  getCurrencyForCountry,
} from "@herobm/shared";

interface CustomerDetailsTabProps {
  customer: api.AccountResponseDto | null;
  dto: Partial<api.AccountResponseDto>;
  isEditable: boolean;
  saving: boolean;
  updateField: (field: keyof api.AccountResponseDto, value: unknown) => void;
  saveField: (field: keyof api.AccountResponseDto, value: unknown) => Promise<void>;
  canManageCredit: boolean;
  taxPositions: api.TaxPositionResponseDto[];
  tradingTerms: api.TradingTermResponseDto[];
  hasDiscountRules: boolean;
  creditAssessment: api.CreditAssessmentResponseDto | null;
  accountGroups: api.CustomerGroupResponseDto[];
  paramsId: string;
}

export function CustomerDetailsTab({
  customer,
  dto,
  isEditable,
  saving,
  updateField,
  saveField,
  canManageCredit,
  taxPositions,
  tradingTerms,
  hasDiscountRules,
  creditAssessment,
  accountGroups,
  paramsId
}: CustomerDetailsTabProps) {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const { baseCurrency, app } = useSettings();
  const [showDiscounts, setShowDiscounts] = useState(false);

  if (!customer) return null;

  const selectedGroup = useGroup(accountGroups, dto?.customerGroupId);

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

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Basic Info Card */}
        <div id="info-section" className="card">
          <h3 className="section-heading">
            { }
            { }
            <span className="material-symbols-outlined">info</span>
            {t("customers.generalInfo")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.name")} *
              </label>
              <input
                type="text"
                className="input"
                value={dto.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={(e) => saveField("name", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.columns.customerNumber")}
              </label>
              <input
                type="text"
                className="input"
                value={customer.customerNumber}
                disabled
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.group")}
              </label>
              <GroupSelect
                type="customer"
                value={dto.customerGroupId || null}
                onChange={(val) => {
                  updateField("customerGroupId", val);
                  saveField("customerGroupId", val);
                }}
                disabled={!isEditable || saving}
                placeholder={t("customers.placeholders.noAccountGroup")}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.parentCustomer")}
              </label>
              <CustomerSelect
                value={(dto as unknown as { parentCustomerId: string | null }).parentCustomerId || null}
                onChange={(val) => {
                  const id = val?.customerId || null;
                  const name = val?.name || "";
                  updateField("parentCustomerId", id);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required to bypass generic field constraint for nested state updates
                  updateField("parentCustomerName" as any, name);
                  saveField("parentCustomerId", id);
                }}
                disabled={!isEditable || saving}
                excludeId={paramsId}
                initialSearchTerm={(dto as unknown as { parentCustomerName: string }).parentCustomerName || ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.country")} *
              </label>
              <select
                className="input"
                value={dto.billingAddressCountry || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField("billingAddressCountry", val);
                  const newCurrency = getCurrencyForCountry(val);
                  if (newCurrency) {
                    updateField("currencyCode", newCurrency);
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  saveField("billingAddressCountry", val);
                  const newCurrency = getCurrencyForCountry(val);
                  if (newCurrency) {
                    saveField("currencyCode", newCurrency);
                  }
                }}
                disabled={!isEditable || saving}
              >
                <option value="">{t("common.notConfigured")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.notesCardHeading")}
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                onBlur={(e) => saveField("notes", e.target.value)}
                placeholder={t("common.notesCardPlaceholder")}
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>

        {/* Credit Overview Card */}
        {canManageCredit && (
          <div id="credit-overview-section" className="card">
            <h3 className="section-heading flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0">info</span>
              <span>{t("salesOrders.creditHold.statusOverview")}</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {t("salesOrders.creditHold.totalOutstanding")}
                </label>
                <p className="font-semibold text-lg">
                  {creditAssessment ? formatAmount(creditAssessment.totalInvoiceBalance, dto.currencyCode || baseCurrency) : "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {t("salesOrders.creditHold.overdue")}
                </label>
                <p className={`font-semibold text-lg ${creditAssessment && creditAssessment.overdueInvoiceBalance > 0 ? "text-red-600" : ""}`}>
                  {creditAssessment ? formatAmount(creditAssessment.overdueInvoiceBalance, dto.currencyCode || baseCurrency) : "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {t("salesOrders.creditHold.glBalance")}
                </label>
                <p className="font-semibold text-lg">
                  {creditAssessment ? formatAmount(creditAssessment.glBalance, dto.currencyCode || baseCurrency) : "—"}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {t("portal.creditLimit")}
                </label>
                <p className="font-semibold text-lg">
                  {formatAmount(parseFloat(dto.creditLimit ?? (creditLimitInheritance.inheritedValue as string) ?? "0"), dto.currencyCode || baseCurrency)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {t("salesOrders.creditHold.systemStatus")}
                </label>
                <p className="font-semibold text-lg flex items-center gap-1.5">
                  {dto.isSalesBlocked ? (
                    <><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span className="text-red-700">Blocked</span></>
                  ) : (
                    <><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span><span className="text-green-700">Good Standing</span></>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing & Tax Card */}
        <div id="pricing-section" className="card">
          <h3 className="section-heading">
            { }
            { }
            <span className="material-symbols-outlined">payments</span>
            FINANCIALS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* ── Row 1 ── */}
            {/* 1. Currency */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.currency")} *
              </label>
              <select
                className="input"
                value={dto.currencyCode}
                onChange={(e) => {
                  updateField("currencyCode", e.target.value);
                  saveField("currencyCode", e.target.value);
                }}
                disabled={!isEditable || saving}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. State */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.state")}
              </label>
              <div
                className="flex items-center gap-3"
                style={{
                  paddingTop: 6,
                  cursor: !isEditable || saving ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (!isEditable || saving) return;
                  const newState =
                    dto.stateCode === CUSTOMER_STATE.ACTIVE
                      ? CUSTOMER_STATE.INACTIVE
                      : CUSTOMER_STATE.ACTIVE;
                  updateField("stateCode", newState);
                  saveField("stateCode", newState);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background:
                      dto.stateCode === CUSTOMER_STATE.ACTIVE
                        ? "var(--accent)"
                        : "var(--border)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    opacity: !isEditable || saving ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: 3,
                      left:
                        dto.stateCode === CUSTOMER_STATE.ACTIVE ? 21 : 3,
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {dto.stateCode ? (
                    <StateName state={dto.stateCode as ValidState} />
                  ) : (
                    ""
                  )}
                </span>
              </div>
            </div>

            {/* Empty column to align next row in 3-col desktop layout */}
            <div className="hidden xl:block"></div>

            {/* ── Row 2 ── */}
            {/* 4. Business Number */}
            <div>
              <label
                className="flex items-center text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)", minHeight: 16 }}
              >
                {t("customers.fields.businessNumber")}
                <FrontendEnrichmentDecorator
                  field="customer.business_number"
                  country={dto.billingAddressCountry || ""}
                  value={dto.businessNumber || ""}
                  isSaving={saving}
                  onEnrich={(data) => {
                    if (data.name && data.name !== dto.name) {
                      updateField("name", data.name);
                      saveField("name", data.name);
                      toast.success(tCommon("enrichment.nameUpdated"));
                    }
                    if (
                      data.isTaxRegistered !== undefined &&
                      data.isTaxRegistered !== dto.isTaxRegistered
                    ) {
                      updateField("isTaxRegistered", data.isTaxRegistered);
                      saveField("isTaxRegistered", data.isTaxRegistered);
                      toast.success(tCommon("enrichment.taxUpdated"));
                    }
                  }}
                />
              </label>
              <input
                type="text"
                className="input"
                value={dto.businessNumber || ""}
                onChange={(e) => {
                  updateField("businessNumber", e.target.value);
                }}
                onBlur={(e) => {
                  saveField("businessNumber", e.target.value);
                }}
                disabled={!isEditable || saving}
                placeholder="Enter business number..."
              />
            </div>

            {/* 5. Tax Registered */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.taxRegistered")}
              </label>
              <div
                className="flex items-center gap-3"
                style={{
                  paddingTop: 6,
                  cursor: !isEditable || saving ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (!isEditable || saving) return;
                  updateField("isTaxRegistered", !dto.isTaxRegistered);
                  saveField("isTaxRegistered", !dto.isTaxRegistered);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: dto.isTaxRegistered
                      ? "var(--accent)"
                      : "var(--border)",
                    position: "relative",
                    transition: "background 0.2s ease",
                    opacity: !isEditable || saving ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: 3,
                      left: dto.isTaxRegistered ? 21 : 3,
                      transition: "left 0.2s ease",
                    }}
                  />
                </div>
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {dto.isTaxRegistered ? t("portal.yes") : t("portal.no")}
                </span>
              </div>
            </div>

            {/* 6. Tax Position */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.taxPosition")}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving}
                value={dto.taxPositionId || ""}
                onChange={(val) => {
                  updateField("taxPositionId", val);
                  saveField("taxPositionId", val);
                }}
                options={taxPositions.map((pos) => ({
                  value: pos.taxPositionId,
                  label: pos.title,
                }))}
                inheritedValue={taxPositionInheritance.inheritedValue}
                inheritedSourceLabel={taxPositionInheritance.inheritedSourceLabel}
              />
            </div>

            {/* ── Row 3 ── */}
            {/* 7. Trading Terms */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("portal.tradingTerms")}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving || !canManageCredit}
                value={dto.tradingTermsId || ""}
                onChange={(val) => {
                  updateField("tradingTermsId", val);
                  saveField("tradingTermsId", val);
                }}
                options={tradingTerms.map((term) => ({
                  value: term.tradingTermsId,
                  label: `${term.code} - ${term.description}`,
                }))}
                inheritedValue={tradingTermsInheritance.inheritedValue}
                inheritedSourceLabel={tradingTermsInheritance.inheritedSourceLabel}
              />
            </div>

            {/* 8. Credit Limit */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("portal.creditLimit")}
              </label>
              <div className="flex items-center gap-3">
                <InheritedNumberInput
                  step="0.01"
                  className="input w-full max-w-xs"
                  value={dto.creditLimit || ""}
                  onChange={(val) => {
                    updateField("creditLimit", val);
                  }}
                  onBlur={(e) => {
                    saveField("creditLimit", e.target.value);
                  }}
                  disabled={!isEditable || saving || !canManageCredit}
                  placeholder="0.00"
                  inheritedValue={creditLimitInheritance.inheritedValue}
                  inheritedSourceLabel={creditLimitInheritance.inheritedSourceLabel}
                />
                {!!creditLimitInheritance.inheritedSourceLabel && (
                    <span className="text-xs italic text-[var(--primary)] ml-2">
                      {tCommon('options.inheritValue', {
                        label: creditLimitInheritance.inheritedValue || '',
                        source: creditLimitInheritance.inheritedSourceLabel || ''
                      })}
                    </span>
                )}
              </div>
            </div>

            {/* 9. Credit Hold */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("portal.creditHold")}
              </label>
              <InheritedSelect
                className="input"
                disabled={!isEditable || saving || !canManageCredit}
                value={dto.isOnCreditHold === true ? 'true' : dto.isOnCreditHold === false ? 'false' : ''}
                onChange={(val) => {
                  const boolVal = val === 'true' ? true : val === 'false' ? false : null;
                  updateField("isOnCreditHold", boolVal);
                  saveField("isOnCreditHold", boolVal);
                }}
                options={[
                  { value: 'true', label: t("portal.yes") },
                  { value: 'false', label: t("portal.no") }
                ]}
                inheritedValue={creditHoldInheritance.inheritedValue}
                inheritedSourceLabel={creditHoldInheritance.inheritedSourceLabel}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.earlyPaymentDiscount")}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <InheritedNumberInput
                    step="0.01"
                    placeholder="0.00"
                    className="input w-full pr-8"
                    value={(dto as { earlyPaymentDiscount?: string }).earlyPaymentDiscount ?? ""}
                     
                    onChange={(val: unknown) =>
                      updateField("earlyPaymentDiscount" as never, val)
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      saveField("earlyPaymentDiscount", e.target?.value ? String(e.target.value) : null)
                    }}
                    inheritedValue={earlyPaymentDiscountInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountInheritance.inheritedSourceLabel}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                {/* eslint-disable-next-line i18next/no-literal-string -- Simple word */}
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  in
                </span>
                <div className="relative w-32">
                  <InheritedNumberInput
                    placeholder="0"
                    className="input w-full pr-12"
                    value={(dto as { earlyPaymentDiscountDays?: number }).earlyPaymentDiscountDays ?? ""}
                     
                    onChange={(val: unknown) =>
                      updateField("earlyPaymentDiscountDays" as never, val)
                    }
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      saveField("earlyPaymentDiscountDays", e.target?.value !== "" ? Number(e.target.value) : null)
                    }}
                    inheritedValue={earlyPaymentDiscountDaysInheritance.inheritedValue}
                    inheritedSourceLabel={earlyPaymentDiscountDaysInheritance.inheritedSourceLabel}
                  />
                  {/* eslint-disable-next-line i18next/no-literal-string -- Simple word */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none text-sm">days</span>
                </div>

                {!!(earlyPaymentDiscountInheritance.inheritedSourceLabel || earlyPaymentDiscountDaysInheritance.inheritedSourceLabel) && (
                    <span className="text-xs italic text-[var(--primary)] ml-2">
                      {tCommon('options.inheritValue', {
                        label: `${earlyPaymentDiscountInheritance.inheritedValue}% in ${earlyPaymentDiscountDaysInheritance.inheritedValue} days`,
                        source: earlyPaymentDiscountInheritance.inheritedSourceLabel || earlyPaymentDiscountDaysInheritance.inheritedSourceLabel || ''
                      })}
                    </span>
                )}
              </div>
            </div>

            {/* 9. Discount Rules */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.discountRules")}
              </label>
              <Button
                variant="secondary"
                className="relative"
                onClick={() => setShowDiscounts(true)}
                disabled={!isEditable || saving}
              >
                {t("customers.fields.manage")}
                {hasDiscountRules && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </Button>
            </div>
          </div>

        </div>
        {/* Address & Contact Card */}
        <div id="address-section" className="card">
          <h3 className="section-heading">
            { }
            { }
            <span className="material-symbols-outlined">location_on</span>
            {t("customers.billing")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.billingEmail")}
              </label>
              <input
                type="email"
                className="input"
                value={dto.emailAddress1 || ""}
                onChange={(e) =>
                  updateField("emailAddress1", e.target.value)
                }
                onBlur={(e) => saveField("emailAddress1", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.phone")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.telephone1 || ""}
                onChange={(e) => updateField("telephone1", e.target.value)}
                onBlur={(e) => saveField("telephone1", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div className="md:col-span-2">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.billingAddress")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.billingAddressLine1 || ""}
                onChange={(e) =>
                  updateField("billingAddressLine1", e.target.value)
                }
                onBlur={(e) => saveField("billingAddressLine1", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div className="md:col-span-2">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("portal.addressLine2")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.billingAddressLine2 || ""}
                onChange={(e) =>
                  updateField("billingAddressLine2", e.target.value)
                }
                onBlur={(e) => saveField("billingAddressLine2", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.city")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.billingAddressCity || ""}
                onChange={(e) =>
                  updateField("billingAddressCity", e.target.value)
                }
                onBlur={(e) => saveField("billingAddressCity", e.target.value)}
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.state")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.billingAddressStateOrProvince || ""}
                onChange={(e) =>
                  updateField("billingAddressStateOrProvince", e.target.value)
                }
                onBlur={(e) =>
                  saveField("billingAddressStateOrProvince", e.target.value)
                }
                disabled={!isEditable || saving}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("common.columns.postalCode")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.billingAddressPostalCode || ""}
                onChange={(e) =>
                  updateField("billingAddressPostalCode", e.target.value)
                }
                onBlur={(e) =>
                  saveField("billingAddressPostalCode", e.target.value)
                }
                disabled={!isEditable || saving}
              />
            </div>
          </div>
        </div>


        {/* Bank Details Card */}
        <div id="bank-section" className="card h-fit">
          <h3 className="section-heading">
            { }
            { }
            <span className="material-symbols-outlined">
              account_balance
            </span>
            <span>{t("portal.bankDetails")}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.bankAccountName")}
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.bankAccountName || ""}
                onChange={(e) =>
                  updateField("bankAccountName", e.target.value)
                }
                onBlur={(e) => saveField("bankAccountName", e.target.value)}
                disabled={!isEditable || saving}
                placeholder="e.g. John Doe Pty Ltd"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <span>BSB</span>
              </label>
              <input
                type="text"
                className="input"
                value={dto.bankBsb || ""}
                onChange={(e) => updateField("bankBsb", e.target.value)}
                onBlur={(e) => saveField("bankBsb", e.target.value)}
                disabled={!isEditable || saving}
                placeholder="e.g. 062-000"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                {t("customers.fields.accountNumber")}
              </label>
              <input
                type="text"
                className="input"
                value={dto.bankAccountNumber || ""}
                onChange={(e) =>
                  updateField("bankAccountNumber", e.target.value)
                }
                onBlur={(e) =>
                  saveField("bankAccountNumber", e.target.value)
                }
                disabled={!isEditable || saving}
                placeholder="e.g. 12345678"
              />
            </div>
          </div>
        </div>
        {/* Hierarchy Card */}
        {customer.childAccounts && customer.childAccounts.length > 0 && (
          <div id="hierarchy-section" className="card h-fit">
            <h3 className="section-heading">
              { }
              { }
              <span className="material-symbols-outlined">
                account_tree
              </span>
              <span>{t("portal.hierarchy")}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="mt-4">
                <label
                  className="block text-xs font-medium mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("customers.fields.childAccounts", {
                    count: customer.childAccounts.length,
                  })}
                </label>
                <div className="flex flex-col gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type missing childAccounts */
                  customer.childAccounts.map((child: any) => (
                    <Link
                      key={child.customerId}
                      href={`/customers/${child.customerId}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover: transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-semibold shrink-0">
                        {child.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {child.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {child.customerNumber}
                        </div>
                      </div>
                      { }
                      { }
                      <span className="material-symbols-outlined text-[var(--text-muted)]">
                        chevron_right
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div id="activity-section" className="card">
          <ActivityTimeline events={(customer.events as unknown as TimelineEvent[]) || []} />
        </div>
      </div>

      <DiscountMatrixSlideOver
        open={showDiscounts}
        onClose={() => setShowDiscounts(false)}
        ownerLabel={
          customer ? `${customer.customerNumber} — ${customer.name}` : ""
        }
        customerId={paramsId}
      />
    </>
  );
}
