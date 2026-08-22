
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
import { formatLocalDate, toInputDateFormat, parseLocalDate } from "@/lib/date";
import ActivityTimeline, { TimelineEvent } from "@/components/shared/ActivityTimeline";
import { StateName } from "@/components/StateBadge";
import DetailTabGrid from "@/components/shared/DetailTabGrid";
import { ValidState } from "@/types/states";
import PageNav from "@/components/shared/PageNav";
import GroupSelect from "@/components/shared/GroupSelect";
import { Button } from '@/components/shared/Button';
import CustomerSelect from "@/components/shared/CustomerSelect";
import DiscountMatrixSlideOver from "@/components/shared/DiscountMatrixSlideOver";
import { ContactSlideOver } from "@/components/shared/ContactSlideOver";
import DeliveryAddressSlideOver from "@/components/shared/DeliveryAddressSlideOver";
import InfoCard from "@/components/shared/InfoCard";
import { ContactCard } from "@/components/shared/ContactCard";
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
  DATA_SOURCE_CONTEXT,
} from "@herobm/shared";
import { toast } from "react-hot-toast";
import { reportError } from "@/lib/api";
import EmailDocumentDialog from "@/components/shared/EmailDocumentDialog";

import { CustomerDetailsTab } from "./components/CustomerDetailsTab";
import { CustomerContactsTab } from "./components/CustomerContactsTab";
import { CustomerAddressesTab } from "./components/CustomerAddressesTab";
import { useAccount } from "./useCustomer";
import { useAuth } from "@/components/shared/AuthGate";
import { SystemResource, hasPermission } from "@herobm/shared";

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
  const { permissions } = useAuth();
  const canManageCredit = hasPermission(permissions, SystemResource.CREDIT_CONTROL, 'write');
  const canArchive = hasPermission(permissions, SystemResource.CUSTOMERS, 'archive');

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



  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as "details" | "contacts" | "delivery" | "salesOrders" | "invoices" | "payments") || "details";
  const [activeTab, setActiveTab] = useState<
    "details" | "contacts" | "delivery" | "salesOrders" | "invoices" | "payments"
  >(initialTab);

  // Statement Dialog State & PDF Generator
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const handleGenerateStatementPdf = async (customPdfText?: string) => {
    if (!customer) return;
    try {
      const response = await api.pdfTemplatesControllerRunHook(
        'customer-statement',
        { customPdfText },
        {
          id: customer.customerId,
          context: DATA_SOURCE_CONTEXT.CUSTOMER_STATEMENT,
        },
      );
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      reportError(err, 'CustomerDetailPage:generateStatementPdf');
      toast.error('Failed to generate Customer Statement PDF');
    }
  };








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
          formatLocalDate(p.value),
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
          formatLocalDate(p.value, undefined, ""),
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
      { field: "paymentDate", headerName: "Date", width: 150, valueFormatter: (p: GridParam) => formatLocalDate(p.value, undefined, "") },
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
        ...(customer.childAccounts && customer.childAccounts.length > 0 ? [{
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
        }] : []),
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

  if (!customer || !dto) return null;

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={customer.name}
            subtitle={customer.customerNumber}
            isSaving={saving}
            nav={<PageNav sections={visibleSections} />}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleGenerateStatementPdf()}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">print</span>
                  Print Statement
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEmailDialogOpen(true)}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">mail</span>
                  Email Statement
                </Button>
              </div>
            }
          />
        }
        footerActions={
          canArchive && customer ? (
            customer.stateCode === CUSTOMER_STATE.ARCHIVED ? (
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
                className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                onClick={archiveAccount}
                disabled={saving}
              >
                {t("salesOrders.buttons.archive")}
              </Button>
            )
          ) : undefined
        }
      >
        {customer.stateCode === CUSTOMER_STATE.ARCHIVED && (
          <div className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700">
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
                  ? (customer.salesBlockReasons as string[]).map((r: string, index: number, array: string[]) => {
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
                      value={toInputDateFormat(dto.overrideCreditHoldUntil)}
                      min={toInputDateFormat(new Date())}
                      disabled={!isEditable || saving}
                      onChange={(e) => {
                        const date = e.target.value ? parseLocalDate(e.target.value) : null;
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
          <DetailTabGrid
            title={tSales("title")}
            headerActions={
              <Button asChild size="sm" variant="primary" className="bg-[#006b5c] hover:bg-[#005246] border-none text-white">
                <Link href={`/sales-orders/new?customerId=${params.id}`}>
                  {tSales("buttons.createOrder")}
                </Link>
              </Button>
            }
            endpoint={`/api/sales-orders?customerId=${encodeURIComponent(params.id)}&limit=50`}
            columns={orderColumns}
            gridKey="customer-orders"
            urlPrefix="orders"
            searchPlaceholder={tSales("placeholders.searchOrders")}
            exportFileName={`orders-${customer.customerNumber}`}
            fetchAll
            rowIdField="id"
            rowHref={(order: { id: string }) => `/sales-orders/${order.id}`}
          />
        )}

        {activeTab === "invoices" && (
          <DetailTabGrid
            title={tSales("invoicesCardHeading")}
            endpoint={`/api/sales-invoices?customerId=${encodeURIComponent(params.id)}&days=0&limit=50`}
            columns={invoiceColumns}
            gridKey="customer-invoices"
            urlPrefix="invoices"
            fetchAll
            rowIdField="invoiceId"
            rowHref={(row: { invoiceId: string; salesOrderId?: string }) => row.salesOrderId ? `/sales-orders/${row.salesOrderId}#invoices-section` : ''}
          />
        )}

        {activeTab === "payments" && (
          <DetailTabGrid
            title="Payments"
            endpoint={`/api/payments?partyId=${encodeURIComponent(params.id)}`}
            columns={paymentColumns}
            gridKey="customer-payments"
            fetchAll
          />
        )}

        {activeTab === "contacts" && (
          <CustomerContactsTab customer={customer} loadAccount={loadAccount} />
        )}

        {activeTab === "delivery" && (
          <CustomerAddressesTab customer={customer} loadAccount={loadAccount} />
        )}

        {activeTab === "details" && (
          <CustomerDetailsTab
            customer={customer}
            dto={dto}
            isEditable={isEditable}
            saving={saving}
            updateField={updateField}
            saveField={saveField}
            canManageCredit={canManageCredit}
            taxPositions={taxPositions}
            tradingTerms={tradingTerms}
            hasDiscountRules={hasDiscountRules}
            creditAssessment={creditAssessment}
            accountGroups={accountGroups}
            paramsId={params.id}
          />
        )}



        {customer && (
          <EmailDocumentDialog
            isOpen={isEmailDialogOpen}
            orderId={customer.customerId}
            orderNumber={customer.customerNumber}
            customerId={customer.customerId}
            hookSlug="customer-statement"
            title="Email Customer Statement"
            defaultSubjectPrefix="Statement of Account"
            documentName="Statement"
            targetId={customer.customerId}
            contextSlug={DATA_SOURCE_CONTEXT.CUSTOMER_STATEMENT}
            onClose={() => setIsEmailDialogOpen(false)}
            onSuccess={() => {
              setIsEmailDialogOpen(false);
              toast.success('Statement email queued successfully!');
            }}
            onPreview={(customText) => handleGenerateStatementPdf(customText)}
          />
        )}
      </DetailsLayout>
    </>
  );
}
