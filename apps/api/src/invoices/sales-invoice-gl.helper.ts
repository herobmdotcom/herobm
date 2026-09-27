import { Decimal } from 'decimal.js';
import { BadRequestException, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { glAccounts } from '@herobm/db-schema';
import { GlService } from '../gl/gl.service';
import { AppConfigService } from '../settings/app-config.service';
import { JOURNAL_ENTRY_SOURCE_TYPE } from '@herobm/shared';

export interface RevenueGroup {
  customerId: string;
  amount: number;
  costCenterId: string | null;
  activityId: string | null;
}

export interface PostSalesInvoiceGlParams {
  tx: DrizzleDB;
  glService: GlService;
  appConfig: AppConfigService;
  logger: Logger;
  customerArAccountId: string | null;
  customerCostCenterId: string | null;
  customerActivityId: string | null;
  revenueGroups: Map<string, RevenueGroup>;
  defaultRevenue: number;
  defaultRevenueCostCenterId: string | null;
  defaultRevenueActivityId: string | null;
  taxGroups: Map<string, number>;
  fxRateDec: Decimal;
  currencyCode: string;
  customerId: string | null;
  orderNumber: string;
  combinedTotal: number;
  invoiceNumber: string;
  invoiceId: string;
  actor: string;
}

export function calculateBaseTotalAmount(
  revenueGroups: Map<string, RevenueGroup>,
  defaultRevenue: number,
  taxGroups: Map<string, number>,
  fxRateDec: Decimal,
): string {
  let totalRoundedCreditsDecTemp = new Decimal(0);
  for (const group of revenueGroups.values()) {
    if (group.amount > 0) {
      totalRoundedCreditsDecTemp = totalRoundedCreditsDecTemp.plus(
        new Decimal(group.amount)
          .mul(fxRateDec)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      );
    }
  }
  if (defaultRevenue > 0) {
    totalRoundedCreditsDecTemp = totalRoundedCreditsDecTemp.plus(
      new Decimal(defaultRevenue)
        .mul(fxRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    );
  }
  for (const [acctId, taxAmt] of taxGroups.entries()) {
    if (taxAmt > 0) {
      totalRoundedCreditsDecTemp = totalRoundedCreditsDecTemp.plus(
        new Decimal(taxAmt)
          .mul(fxRateDec)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      );
    }
  }
  return totalRoundedCreditsDecTemp.toFixed(2);
}

export async function postSalesInvoiceGlJournal(
  params: PostSalesInvoiceGlParams,
): Promise<void> {
  const {
    tx,
    glService,
    appConfig,
    logger,
    customerArAccountId,
    customerCostCenterId,
    customerActivityId,
    revenueGroups,
    defaultRevenue,
    defaultRevenueCostCenterId,
    defaultRevenueActivityId,
    taxGroups,
    fxRateDec,
    currencyCode,
    customerId,
    orderNumber,
    combinedTotal,
    invoiceNumber,
    invoiceId,
    actor,
  } = params;

  const settings = await glService.getSettings(tx);
  const effectiveArAccountId =
    customerArAccountId || settings?.defaultArAccountId;

  if (!effectiveArAccountId) {
    throw new BadRequestException(
      'Cannot create invoice: Accounts Receivable account (defaultArAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
    );
  }

  // Collect all distinct Customer IDs logically needed
  const distinctAccountIds = new Set<string>();
  distinctAccountIds.add(effectiveArAccountId);
  if (settings?.defaultSalesTaxAccountId)
    distinctAccountIds.add(settings.defaultSalesTaxAccountId);
  for (const acctId of taxGroups.keys()) {
    if (acctId !== 'fallback') {
      distinctAccountIds.add(acctId);
    }
  }
  if (settings?.defaultRevenueAccountId)
    distinctAccountIds.add(settings.defaultRevenueAccountId);
  for (const group of revenueGroups.values()) {
    distinctAccountIds.add(group.customerId);
  }

  const settingsIds = Array.from(distinctAccountIds).filter(Boolean);

  const glAcct = glAccounts;
  const acctRows =
    settingsIds.length > 0
      ? await tx
          .select({
            glAccountId: glAcct.glAccountId,
            accountCode: glAcct.accountCode,
          })
          .from(glAcct)
          .where(
            sql`${glAcct.glAccountId} IN (${sql.join(
              settingsIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];

  const idToCode = new Map(acctRows.map((a) => [a.glAccountId, a.accountCode]));

  const arCode = idToCode.get(effectiveArAccountId);
  if (!arCode) {
    throw new BadRequestException(
      `Cannot create invoice: Accounts Receivable account '${effectiveArAccountId}' not found in Chart of Accounts.`,
    );
  }

  const defaultRevenueCode = settings?.defaultRevenueAccountId
    ? idToCode.get(settings.defaultRevenueAccountId)
    : null;

  const taxCode = settings?.defaultSalesTaxAccountId
    ? idToCode.get(settings.defaultSalesTaxAccountId)
    : null;

  // First calculate rounded credits to ensure AR Debit balances perfectly
  let totalRoundedCreditsDec = new Decimal(0);
  const revenueLinesDec = [];

  for (const group of revenueGroups.values()) {
    if (group.amount > 0) {
      const revCreditDec = new Decimal(group.amount)
        .mul(fxRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalRoundedCreditsDec = totalRoundedCreditsDec.plus(revCreditDec);
      revenueLinesDec.push({
        ...group,
        roundedBaseAmount: revCreditDec.toNumber(),
      });
    }
  }

  let defaultRevenueBaseAmount = 0;
  if (defaultRevenue > 0) {
    const defRevCreditDec = new Decimal(defaultRevenue)
      .mul(fxRateDec)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    totalRoundedCreditsDec = totalRoundedCreditsDec.plus(defRevCreditDec);
    defaultRevenueBaseAmount = defRevCreditDec.toNumber();
  }

  const taxLinesDec = [];
  for (const [acctId, taxAmt] of taxGroups.entries()) {
    if (taxAmt > 0) {
      const taxCreditDec = new Decimal(taxAmt)
        .mul(fxRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalRoundedCreditsDec = totalRoundedCreditsDec.plus(taxCreditDec);
      taxLinesDec.push({
        acctId,
        taxAmt,
        roundedBaseAmount: taxCreditDec.toNumber(),
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
  const glLines: any[] = [
    {
      accountCode: arCode,
      debit: totalRoundedCreditsDec.toNumber(),
      credit: 0,
      foreignCurrency: currencyCode,
      foreignDebit: combinedTotal,
      foreignCredit: 0,
      memo: `AR: ${invoiceNumber}`,
      partyType: 'customer',
      partyId: customerId,
      costCenterId:
        customerCostCenterId || appConfig.defaultCostCenterId() || undefined,
      activityId:
        customerActivityId || appConfig.defaultActivityId() || undefined,
    },
  ];

  for (const group of revenueLinesDec) {
    let code = idToCode.get(group.customerId);
    if (!code && defaultRevenueCode) {
      code = defaultRevenueCode;
    }

    if (!code) {
      throw new BadRequestException(
        `Cannot create invoice: Revenue account '${group.customerId}' not found in Chart of Accounts.`,
      );
    }

    glLines.push({
      accountCode: code,
      debit: 0,
      credit: group.roundedBaseAmount,
      foreignCurrency: currencyCode,
      foreignDebit: 0,
      foreignCredit: group.amount,
      memo: `Revenue: ${invoiceNumber}`,
      costCenterId: group.costCenterId || undefined,
      activityId: group.activityId || undefined,
    });
  }

  if (defaultRevenueBaseAmount > 0) {
    if (!defaultRevenueCode) {
      throw new BadRequestException(
        'Cannot create invoice: Default Revenue account (defaultRevenueAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
      );
    }

    glLines.push({
      accountCode: defaultRevenueCode,
      debit: 0,
      credit: defaultRevenueBaseAmount,
      foreignCurrency: currencyCode,
      foreignDebit: 0,
      foreignCredit: defaultRevenue,
      memo: `Revenue: ${invoiceNumber}`,
      costCenterId: defaultRevenueCostCenterId || undefined,
      activityId: defaultRevenueActivityId || undefined,
    });
  }

  for (const tLine of taxLinesDec) {
    let effectiveTaxCode =
      tLine.acctId !== 'fallback' ? idToCode.get(tLine.acctId) : taxCode;
    if (!effectiveTaxCode && taxCode) {
      effectiveTaxCode = taxCode;
    }

    if (!effectiveTaxCode) {
      throw new BadRequestException(
        'Cannot create invoice: Sales Tax account (defaultSalesTaxAccountId) is not configured in GL Settings. Please configure it in Admin → Settings → Financial.',
      );
    }

    glLines.push({
      accountCode: effectiveTaxCode,
      debit: 0,
      credit: tLine.roundedBaseAmount,
      foreignCurrency: currencyCode,
      foreignDebit: 0,
      foreignCredit: tLine.taxAmt,
      memo: `GST: ${invoiceNumber}`,
    });
  }

  if (combinedTotal > 0) {
    if (glLines.length < 2) {
      throw new BadRequestException(
        'Cannot create invoice: Failed to construct balancing GL journal entry lines. Please verify that Default Accounts Receivable, Default Revenue, and Default Sales Tax accounts are configured in Admin → Settings → Financial.',
      );
    }

    await glService.postJournalEntry(
      glLines,
      {
        sourceType: JOURNAL_ENTRY_SOURCE_TYPE.SALES_INVOICE,
        sourceId: invoiceId,
        memo: `Sales invoice ${invoiceNumber} for order ${orderNumber}`,
        actor,
      },
      tx,
    );

    logger.log(`GL journal posted for sales invoice ${invoiceNumber}`);
  }
}
