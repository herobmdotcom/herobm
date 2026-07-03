
"use client";

import { useState, use, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import EntityHeader from "@/components/shared/EntityHeader";
import EntityBanner from "@/components/shared/EntityBanner";
import { FrontendEnrichmentDecorator } from "@/components/shared/FrontendEnrichmentDecorator";
import * as api from "@herobm/sdk";
import DetailsLayout from "@/components/shared/DetailsLayout";
import { formatAmount } from "@/lib/currency";
import ActivityTimeline, { TimelineEvent } from "@/components/shared/ActivityTimeline";
import { StateName } from "@/components/StateBadge";
import DataGrid from "@/components/DataGrid";
import { ValidState } from "@/types/states";
import PageNav from "@/components/shared/PageNav";
import GroupSelect from "@/components/shared/GroupSelect";
import { Button } from '@/components/shared/Button';
import CustomerSelect from "@/components/shared/CustomerSelect";
import DiscountMatrixSlideOver from "@/components/shared/DiscountMatrixSlideOver";
import { ContactSlideOver } from "./ContactSlideOver";
import DeliveryAddressSlideOver from "@/components/shared/DeliveryAddressSlideOver";
import InfoCard from "@/components/shared/InfoCard";
import InheritedSelect from "@/components/shared/InheritedSelect";
import InheritedNumberInput from "@/components/shared/InheritedNumberInput";
import { useInheritance, useGroup } from "@/hooks/useInheritance";
import { useSettings } from "@/components/SettingsProvider";
import {
  getErrorMessage,
  CURRENCIES,
  COUNTRIES,
  CUSTOMER_STATE,
  getCurrencyForCountry,
} from "@herobm/shared";
import { toast } from "react-hot-toast";

import { useAccount } from "./useCustomer";
import { useAuth } from "@/components/shared/AuthGate";
import { SystemResource } from "@herobm/shared";

export default function AccountDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { baseCurrency, app } = useSettings();
  const t = useTranslations();
  const tSales = useTranslations("salesOrders");
  const tCommon = useTranslations("common");
  const tStates = useTranslations("common.states");
  const params = use(paramsPromise);
  const router = useRouter();
  const { permissions, role } = useAuth();
  const canManageCredit = role === "admin" || permissions.some(p => p.resource === SystemResource.CREDIT_CONTROL && p.action === "write");

  const {
    customer,
    loading,
    saving,
    dto,
    isDirty,
    isEditable,
    taxPositions,
    tradingTerms,
    hasDiscountRules,
    loadAccount,
    updateField,
    saveField,
    handleSave,
    archiveAccount,
    unarchiveAccount,
    creditAssessment,
    accountGroups,
  } = useAccount(params.id);

  useDocumentTitle(
    customer
      ? customer.customerNumber
        ? `${customer.customerNumber} - ${customer.name}`
        : customer.name
      : null,
  );

  const selectedGroup = useGroup(accountGroups, dto.customerGroupId);

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

  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as "details" | "contacts" | "delivery" | "salesOrders" | "invoices" | "payments") || "details";
  const [activeTab, setActiveTab] = useState<
    "details" | "contacts" | "delivery" | "salesOrders" | "invoices" | "payments"
  >(initialTab);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [isContactSlideOverOpen, setIsContactSlideOverOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<api.ContactResponseDto | null>(null);

  const handleAddContactClick = () => {
    setEditingContact(null);
    setIsContactSlideOverOpen(true);
  };

  const handleEditContactClick = (contact: api.ContactResponseDto) => {
    setEditingContact(contact);
    setIsContactSlideOverOpen(true);
  };

  const handleDeleteContactClick = async (contactId: string) => {
    if (window.confirm(t("customers.contactManagement.confirmDeleteContact"))) {
      try {
        await api.contactsControllerRemove(contactId);
        toast.success(t("customers.contactManagement.contactDeleted"));
        loadAccount();
      } catch (err: unknown) {
        toast.error(getErrorMessage(err));
      }
    }
  };

  const [isAddressSlideOverOpen, setIsAddressSlideOverOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<api.DeliveryAddressResponseDto | null>(null);

  const handleAddAddressClick = () => {
    setEditingAddress(null);
    setIsAddressSlideOverOpen(true);
  };

  const handleEditAddressClick = (addr: api.DeliveryAddressResponseDto) => {
    setEditingAddress(addr);
    setIsAddressSlideOverOpen(true);
  };

  const handleDeleteAddressClick = async (addressId: string) => {
    if (window.confirm("Are you sure you want to delete this delivery address?")) {
      try {
        await api.deliveryAddressesControllerRemove(addressId);
        toast.success("Delivery address deleted");
        loadAccount();
      } catch (err: unknown) {
        toast.error(getErrorMessage(err));
      }
    }
  };

  const handleOrderRowClicked = useCallback(
    (order: any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Row data passed from DataGrid is dynamically typed */) => {
      router.push(`/sales-orders/${order.id}`);
    },
    [router],
  );

  const handleInvoiceRowClicked = useCallback(
    (row: any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Row data passed from DataGrid is dynamically typed */) => {
      if (row.salesOrderId) {
        router.push(`/sales-orders/${row.salesOrderId}#invoices-section`);
      }
    },
    [router],
  );

  const orderColumns = useMemo<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any -- ColDef typing requires structural compatibility workaround */>(
    () => [
      {
        field: "orderNumber",
        headerName: tCommon("columns.orderNumber"),
        width: 150,
        pinned: "left" as const,
      },
      {
        field: "name",
        headerName: tCommon("columns.name"),
        flex: 1,
        minWidth: 160,
      },
      {
        field: "stateCode",
        headerName: tCommon("columns.status"),
        width: 110,
        valueFormatter: (p: { value?: unknown }) => {
          if (!p.value) return "";
          const s = String(p.value).toLowerCase();
          return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
        },
      },
      {
        field: "customerOrderNumber",
        headerName: tCommon("columns.customerPO"),
        width: 140,
      },
      {
        field: "totalPrice",
        headerName: tCommon("columns.totalPrice"),
        width: 120,
        type: "numericColumn",
        valueGetter: (p: { data?: { totalPrice?: string | number } }) =>
          p.data?.totalPrice ? parseFloat(String(p.data.totalPrice)) : null,
        valueFormatter: (p: { value?: number; data?: { currencyCode?: string } }) =>
          !p.value || p.value === 0
            ? "—"
            : formatAmount(p.value, p.data?.currencyCode || baseCurrency),
      },
      {
        field: "createdOn",
        headerName: tCommon("columns.date"),
        width: 110,
        valueFormatter: (p: { value?: string | number | Date }) =>
          p.value ? new Date(p.value).toLocaleDateString() : "—",
      },
    ],
    [tCommon],
  );

  const invoiceColumns = useMemo<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any -- ColDef typing requires structural compatibility workaround */>(
    () => [
      { field: "invoiceId", headerName: "ID", hide: true },
      {
        field: "invoiceNumber",
        headerName: tSales("columns.invoiceNumber"),
        width: 180,
      },
      {
        field: "orderNumber",
        headerName: tSales("columns.orderNumber"),
        width: 160,
      },
      {
        field: "createdOn",
        headerName: tSales("columns.date"),
        width: 200,
        valueFormatter: (p: { value?: string | number | Date }) =>
          p.value ? new Date(p.value).toLocaleDateString() : "",
      },
      {
        field: "totalAmount",
        headerName: tSales("columns.amount"),
        type: "numericColumn",
        width: 150,
        valueGetter: (p: { data?: { totalAmount?: string | number } }) =>
          p.data?.totalAmount ? parseFloat(String(p.data.totalAmount)) : null,
        valueFormatter: (p: { value?: number; data?: { currencyCode?: string } }) =>
          !p.value || p.value === 0
            ? "—"
            : formatAmount(p.value, p.data?.currencyCode || "EUR"),
      },
      {
        field: "stateCode",
        headerName: tSales("columns.state"),
        width: 140,
        valueFormatter: (p: { value?: unknown }) => {
          if (!p.value) return "";
          const s = String(p.value).toLowerCase();
          return tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0]) : String(p.value);
        },
      },
    ],
    [tSales],
  );

  type GridParam = { value?: string | number | null; data?: { currencyCode?: string } };

  const paymentColumns = useMemo<Record<string, unknown>[]>(
    () => [
      { field: "paymentNumber", headerName: "Payment No.", width: 150 },
      { field: "paymentDate", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => p.value ? new Date(p.value).toLocaleDateString() : "" },
      { field: "modeOfPayment", headerName: "Mode", width: 150 },
      { field: "totalAmount", headerName: "Total Amount", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
      { field: "unallocatedAmount", headerName: "Unallocated", type: "numericColumn", width: 150, valueFormatter: (p: GridParam) => p.value ? formatAmount(Number(p.value), p.data?.currencyCode || baseCurrency) : "—" },
      { field: "stateCode", headerName: "Status", width: 140, valueFormatter: (p: GridParam) => p.value ? (tStates.has(String(p.value).toLowerCase() as never) ? tStates(String(p.value).toLowerCase() as never) : String(p.value)) : "" }
    ],
    [tStates, baseCurrency],
  );

  if (loading)
    return (
      <>
        <div className="p-8">{t("common.loading")}</div>
      </>
    );
  if (!customer)
    return (
      <>
        <div className="p-8">{t("common.noMatchingResults")}</div>
      </>
    );

  const visibleSections = [
    {
      id: "tab-details",
      label: t("customers.overview"),
      isSubPage: true,
      isActive: activeTab === "details",
      onClick: () => setActiveTab("details"),
      subtargets: [
        {
          id: "info-section",
          label: "Info",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("info-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },
        ...(canManageCredit ? [{
          id: "credit-overview-section",
          label: "Credit",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("credit-overview-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        }] : []),
        {
          id: "pricing-section",
          label: "Financials",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("pricing-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },
        {
          id: "address-section",
          label: "Billing Address",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("address-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },

        {
          id: "bank-section",
          label: "Bank",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("bank-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },
        {
          id: "hierarchy-section",
          label: "Hierarchy",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("hierarchy-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },
        {
          id: "activity-section",
          label: "Activity",
          onClick: () => {
            setActiveTab("details");
            setTimeout(
              () =>
                document
                  .getElementById("activity-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          },
        },
      ],
    },
    {
      id: "tab-contacts",
      label: "Contacts",
      isSubPage: true,
      isActive: activeTab === "contacts",
      onClick: () => setActiveTab("contacts"),
    },
    {
      id: "tab-delivery",
      label: "Delivery",
      isSubPage: true,
      isActive: activeTab === "delivery",
      onClick: () => setActiveTab("delivery"),
    },
    {
      id: "tab-sales",
      label: t("customers.orders"),
      isSubPage: true,
      isActive: activeTab === "salesOrders",
      onClick: () => setActiveTab("salesOrders"),
    },
    {
      id: "tab-invoices",
      label: t("customers.invoices"),
      isSubPage: true,
      isActive: activeTab === "invoices",
      onClick: () => setActiveTab("invoices"),
    },
    {
      id: "tab-payments",
      label: "Payments",
      isSubPage: true,
      isActive: activeTab === "payments",
      onClick: () => setActiveTab("payments"),
    },
  ];

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={customer.name}
            subtitle={customer.customerNumber}
            isSaving={saving}
            nav={<PageNav sections={visibleSections} />}
          />
        }
      >
        {customer.stateCode === CUSTOMER_STATE.ARCHIVED && (
          <div
            className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3"
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#b45309",
            }}
          >
            <div>
              <strong className="font-semibold text-amber-800">
                {t("salesOrders.archivedBannerTitle")}
              </strong>{" "}
              {t("salesOrders.archivedBannerBody")}
            </div>
          </div>
        )}

        {customer.isSalesBlocked && (
          <div className="px-4 lg:px-6 pt-4">
            <EntityBanner
              type={customer.overrideCreditHoldUntil && new Date(customer.overrideCreditHoldUntil) > new Date() ? 'warning' : 'error'}
              title={customer.overrideCreditHoldUntil && new Date(customer.overrideCreditHoldUntil) > new Date() ? t('customers.creditHold.overriddenTitle') : t('customers.creditHold.activeTitle')}
              description={
                customer.salesBlockReasons?.length
                  ? customer.salesBlockReasons.map((r, index, array) => {
                      const text = t(`customers.creditHold.reasons.${r}` as Parameters<typeof t>[0]);
                      const isLast = index === array.length - 1;
                      
                      if (r === 'credit_limit_exceeded' && customer.creditAssessment) {
                        const balance = formatAmount(customer.creditAssessment.totalInvoiceBalance, customer.currencyCode || baseCurrency);
                        const limit = formatAmount(Number(customer.effectiveCreditLimit || 0), customer.currencyCode || baseCurrency);
                        return (
                          <span key={r}>
                            {text} ({balance} / {limit})
                            {!isLast && ' • '}
                          </span>
                        );
                      } else if (r === 'overdue_balance' && customer.creditAssessment) {
                        const overdue = formatAmount(customer.creditAssessment.overdueInvoiceBalance, customer.currencyCode || baseCurrency);
                        return (
                          <span key={r}>
                            {text} ({overdue}
                            {customer.creditAssessment.oldestOverdueInvoice && (
                              <>
                                {' - '}
                                {customer.creditAssessment.oldestOverdueInvoiceId ? (
                                  <Link href={`/sales-invoices/${customer.creditAssessment.oldestOverdueInvoiceId}`} className="underline hover:text-red-700">
                                    {customer.creditAssessment.oldestOverdueInvoice}
                                  </Link>
                                ) : (
                                  customer.creditAssessment.oldestOverdueInvoice
                                )}
                              </>
                            )}
                            )
                            {!isLast && ' • '}
                          </span>
                        );
                      }
                      return (
                        <span key={r}>
                          {text}
                          {!isLast && ' • '}
                        </span>
                      );
                    })
                  : t('customers.creditHold.activeDesc')
              }
              action={
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {dto.overrideCreditHoldUntil && new Date(dto.overrideCreditHoldUntil) > new Date() && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 text-red-600 hover:bg-red-50 hover:border-red-200 bg-white"
                      onClick={() => {
                        updateField("overrideCreditHoldUntil", null);
                        saveField("overrideCreditHoldUntil", null);
                      }}
                      disabled={!isEditable || saving}
                    >
                      {t("common.buttons.clear")}
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium whitespace-nowrap">
                      Override until:
                    </span>
                    <input
                      type="date"
                      className="input text-sm w-full md:w-auto bg-white"
                      value={dto.overrideCreditHoldUntil ? new Date(dto.overrideCreditHoldUntil).toISOString().split('T')[0] : ''}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={!isEditable || saving}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        updateField("overrideCreditHoldUntil", date);
                        saveField("overrideCreditHoldUntil", date);
                      }}
                    />
                  </div>
                </div>
              }
            />
          </div>
        )}

        {activeTab === "salesOrders" && (
          <div className="flex-1 min-h-0 flex flex-col w-full h-full p-4 lg:p-6">
            <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid
                endpoint={`/api/sales-orders?customerId=${encodeURIComponent(params.id)}&limit=50`}
                columns={orderColumns}
                gridKey="customer-orders"
                urlPrefix="orders"
                searchPlaceholder={tSales("placeholders.searchOrders")}
                exportFileName={`orders-${customer.customerNumber}`}
                fetchAll
                rowIdField="id"
                onRowClicked={handleOrderRowClicked}
                renderHeader={({
                  searchInput,
                  optionsButton,
                  rowCount,
                  loading,
                }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2
                        className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0"
                        style={{ fontFamily: "Manrope, sans-serif" }}
                      >
                        {tSales("title")}
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span
                          className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                          style={{ fontFamily: "Manrope, sans-serif" }}
                        >
                          {tCommon("grid.rowCountLabel")}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? "..." : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">{searchInput}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                      <Link
                        href={`/sales-orders/new?customerId=${params.id}`}
                        className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110"
                      >
                        {tSales("buttons.createOrder")}
                      </Link>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="flex-1 min-h-0 flex flex-col w-full h-full p-4 lg:p-6">
            <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid
                endpoint={`/api/sales-invoices?customerId=${encodeURIComponent(params.id)}&days=0&limit=50`}
                columns={invoiceColumns}
                gridKey="customer-invoices"
                urlPrefix="invoices"
                fetchAll
                rowIdField="invoiceId"
                onRowClicked={handleInvoiceRowClicked}
                renderHeader={({
                  searchInput,
                  optionsButton,
                  rowCount,
                  loading,
                }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2
                        className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0"
                        style={{ fontFamily: "Manrope, sans-serif" }}
                      >
                        {tSales("invoicesCardHeading")}
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span
                          className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                          style={{ fontFamily: "Manrope, sans-serif" }}
                        >
                          {tCommon("grid.rowCountLabel")}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? "..." : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">{searchInput}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <div className="flex-1 min-h-0 flex flex-col z-10 w-full h-full pb-6">
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
              <DataGrid
                endpoint={`/api/payments?partyId=${encodeURIComponent(params.id)}`}
                columns={paymentColumns}
                gridKey="customer-payments"
                fetchAll
                renderHeader={({
                  searchInput,
                  optionsButton,
                  rowCount,
                  loading,
                }) => (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4 flex-1">
                      <h2
                        className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0"
                        style={{ fontFamily: "Manrope, sans-serif" }}
                      >
                        Payments
                      </h2>
                      <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                        <span
                          className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                          style={{ fontFamily: "Manrope, sans-serif" }}
                        >
                          {tCommon("grid.rowCountLabel")}
                        </span>
                        <span className="text-[11px] font-bold text-[#006b5c]">
                          {loading ? "..." : rowCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 ml-4 max-w-md">{searchInput}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {optionsButton}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="flex flex-col gap-3">
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <h3 className="section-heading m-0">
                  { }
                  { }
                  <span className="material-symbols-outlined">group</span>
                  {t("customers.contacts")}
                </h3>
                <Button variant="primary" size="sm" onClick={handleAddContactClick}>
                  {t("customers.contactManagement.addContact")}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(customer.contacts as unknown as api.ContactResponseDto[]) && (customer.contacts as unknown as api.ContactResponseDto[]).length > 0 ? [...(customer.contacts as unknown as api.ContactResponseDto[])].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.firstName || '').localeCompare(b.firstName || '')).map((contact) => (
                  <InfoCard
                    key={contact.id}
                    title={`${contact.firstName} ${contact.lastName}`}
                    isPrimary={contact.isPrimary}
                    primaryLabel={t("customers.contactManagement.primaryBadge")}
                    badges={
                      <>
                        <div className="flex items-center ml-auto">
                          <Button variant="ghost"
                            type="button"
                            className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                            onClick={() => handleEditContactClick(contact)}
                            title={t("customers.contactManagement.editContact")}
                          >
                            { }
                            { }
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Button>
                          <Button variant="ghost"
                            type="button"
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                            onClick={() => handleDeleteContactClick(contact.id)}
                            title={t("customers.contactManagement.deleteContact")}
                          >
                            { }
                            { }
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </Button>
                        </div>
                      </>
                    }
                  >
                    { }
                    <div className="text-sm text-gray-600">{contact.jobTitle || t("portal.noTitle")}</div>
                    {(contact.phone || contact.mobile) && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            { }
                            { }
                            <span className="material-symbols-outlined text-[14px] text-gray-400">phone</span>
                            <a href={`tel:${contact.phone}`} className="hover:text-[var(--accent)] transition-colors">{contact.phone}</a>
                          </div>
                        )}
                        {contact.mobile && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            { }
                            { }
                            <span className="material-symbols-outlined text-[14px] text-gray-400">smartphone</span>
                            <a href={`tel:${contact.mobile}`} className="hover:text-[var(--accent)] transition-colors">{contact.mobile}</a>
                          </div>
                        )}
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1.5">
                        { }
                        { }
                        <span className="material-symbols-outlined text-[14px] text-gray-400">mail</span>
                        <a href={`mailto:${contact.email}`} className="text-[var(--accent)] hover:underline truncate">
                          {contact.email}
                        </a>
                      </div>
                    )}
                  </InfoCard>
                )) : (
                  <>
                    { }
                    <div className="text-gray-500 text-sm py-4">{t("portal.noContactsFound")}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="flex flex-col gap-3">
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="section-heading mb-0">
                  { }
                  { }
                  <span className="material-symbols-outlined">local_shipping</span>
                  {t("customers.deliveryAddresses")}
                </h3>
                { }
                <Button variant="primary" size="sm" onClick={handleAddAddressClick}>{t("portal.addAddress")}</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customer.deliveryAddresses && customer.deliveryAddresses.length > 0 ? customer.deliveryAddresses.map((addr: any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Unresolved nested DTO type */) => (
                  <InfoCard 
                    key={addr.id} 
                    title={addr.addressName || 'Unnamed Address'}
                    isPrimary={addr.isPrimary}
                    headerRight={
                      <>
                        <div className="flex gap-1 ml-auto">
                          <Button variant="ghost"
                            type="button"
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                            onClick={() => handleEditAddressClick(addr)}
                            title="Edit Address"
                          >
                            { }
                            { }
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Button>
                          <Button variant="ghost"
                            type="button"
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                            onClick={() => handleDeleteAddressClick(addr.id)}
                            title="Delete Address"
                          >
                            { }
                            { }
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </Button>
                        </div>
                      </>
                    }
                  >
                    <div className="mt-2">
                      {(addr.recipientName || addr.recipientPhone) && (
                        <div className="text-sm text-gray-600">
                          {[addr.recipientName, addr.recipientPhone].filter(Boolean).join(' - ')}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">{addr.addressLine1}</div>
                      {addr.addressLine2 && <div className="text-sm text-gray-600">{addr.addressLine2}</div>}
                    <div className="text-sm text-gray-600">{addr.city}{addr.city && (addr.stateOrProvince || addr.postalCode) ? ', ' : ''}{addr.stateOrProvince} {addr.postalCode}</div>
                    <div className="text-sm text-gray-600">{COUNTRIES.find(c => c.code === addr.country)?.name || addr.country}</div>
                    </div>
                  </InfoCard>
                )) : (
                  <>
                    { }
                    <div className="text-gray-500 text-sm py-4">{t("portal.noDeliveryAddressesFound")}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "details" && (
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
                    value={dto.parentCustomerId || null}
                    onChange={(val) => {
                      updateField("parentCustomerId", val?.customerId || null);
                      saveField("parentCustomerId", val?.customerId || null);
                    }}
                    disabled={!isEditable || saving}
                    excludeId={params.id}
                    initialSearchTerm={dto.parentCustomerName || ""}
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
                      value: term.id,
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
                      {customer.childAccounts.map((child: any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Unresolved nested DTO type */) => (
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

            {/* Bottom Actions */}
            <div className="flex justify-end mt-4">
              {customer.stateCode === CUSTOMER_STATE.ARCHIVED ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={unarchiveAccount}
                  disabled={saving}
                >
                  {t("salesOrders.buttons.unarchive")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ color: "#ef4444", borderColor: "#ef4444" }}
                  onClick={archiveAccount}
                  disabled={saving}
                >
                  {t("salesOrders.buttons.archive")}
                </Button>
              )}
            </div>
          </div>
        )}

        <DiscountMatrixSlideOver
          open={showDiscounts}
          onClose={() => setShowDiscounts(false)}
          ownerLabel={
            customer ? `${customer.customerNumber} — ${customer.name}` : ""
          }
          customerId={params.id}
        />

        {customer && (
          <>
            <ContactSlideOver
              isOpen={isContactSlideOverOpen}
              onClose={() => setIsContactSlideOverOpen(false)}
              entityId={customer.customerId}
              entityType="customer"
              contactId={editingContact?.id}
              existingData={editingContact || undefined}
              defaultCountry={customer.billingAddressCountry || undefined}
              onSaved={() => {
                setIsContactSlideOverOpen(false);
                loadAccount();
              }}
            />
            <DeliveryAddressSlideOver
              isOpen={isAddressSlideOverOpen}
              onClose={() => setIsAddressSlideOverOpen(false)}
              customerId={customer.customerId}
              customerName={customer.name || ''}
              addressId={editingAddress?.id}
              existingData={editingAddress as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Form component expects partial interface mismatches */}
              defaultCountry={customer.billingAddressCountry || undefined}
              onSaved={() => {
                setIsAddressSlideOverOpen(false);
                loadAccount();
              }}
            />
          </>
        )}
      </DetailsLayout>
    </>
  );
}
