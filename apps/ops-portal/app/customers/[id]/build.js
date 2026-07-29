const fs = require('fs');

const pageContent = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/customers/[id]/page.tsx', 'utf8').split('\n');

const detailsBlock = pageContent.slice(866, 1728).join('\n'); // activeTab === "details" block
const slideOverBlock = pageContent.slice(1729, 1738).join('\n'); // DiscountMatrixSlideOver

const template = `"use client";

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
  customer: any;
  dto: any;
  isEditable: boolean;
  saving: boolean;
  updateField: (field: string, value: any) => void;
  saveField: (field: string, value: any) => void;
  canManageCredit: boolean;
  taxPositions: any[];
  tradingTerms: any[];
  hasDiscountRules: boolean;
  creditAssessment: any;
  accountGroups: any[];
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

  const selectedGroup = useGroup(accountGroups, dto?.customerGroupId);

  const creditHoldInheritance = useInheritance([
    { 
      value: selectedGroup?.isOnCreditHold === true ? 'true' : selectedGroup?.isOnCreditHold === false ? 'false' : null, 
      sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group'
    }
  ]);

  const taxPositionInheritance = useInheritance([
    { value: selectedGroup?.taxPositionId, sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group' },
    { value: app?.defaultCustomerTaxPositionId, sourceLabel: 'System Default' }
  ]);

  const tradingTermsInheritance = useInheritance([
    { value: selectedGroup?.tradingTermsId, sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group' },
    { value: app?.defaultCustomerTermsId, sourceLabel: 'System Default' }
  ]);

  const creditLimitInheritance = useInheritance([
    { value: selectedGroup?.creditLimit, sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group' }
  ]);

  const earlyPaymentDiscountInheritance = useInheritance([
    { value: (selectedGroup as { earlyPaymentDiscount?: string })?.earlyPaymentDiscount, sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group' }
  ]);

  const earlyPaymentDiscountDaysInheritance = useInheritance([
    { value: (selectedGroup as { earlyPaymentDiscountDays?: number })?.earlyPaymentDiscountDays, sourceLabel: selectedGroup?.groupCode ? \`Group \${selectedGroup.groupCode}\` : 'Group' }
  ]);

  return (
    <>
      ${detailsBlock.replace(/params\.id/g, 'paramsId')}
      ${slideOverBlock.replace(/params\.id/g, 'paramsId')}
    </>
  );
}
`;

fs.writeFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/customers/[id]/components/CustomerDetailsTab.tsx', template);
console.log('CustomerDetailsTab.tsx generated successfully.');
