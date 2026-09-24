import { randomUUID } from 'crypto';
import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesInvoices,
  salesInvoiceLines,
  customers,
  glAccounts,
  products as coreProducts,
  customerGroups,
  productGroups,
  tradingTerms,
  organizations,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import { resolveGlDimensions } from '../common/utils/gl-resolution.util';
import { calculateDueDate } from '../settings/trading-terms.utils';
import {
  resolveEffectiveTradingTermsId,
  resolveEffectiveEarlyPaymentDiscount,
} from '../customers/credit-control.utils';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { computeLinePrice, JOURNAL_ENTRY_SOURCE_TYPE } from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { SALES_INVOICE_STATE } from '@herobm/shared';
import { generateInvoiceNumber } from './sales-invoice-utils';
import { changeSalesInvoiceStateHelper } from './sales-invoice-state.helper';

@Injectable()
export class SalesInvoiceProjectService {
  private readonly logger = new Logger(SalesInvoiceProjectService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * Create a native Sales Invoice directly from a project (T&M, Milestones, Progress Drawdown)
   */
  async createProjectInvoice(
    project: {
      projectId: string;
      projectNumber: string;
      customerId: string;
      currencyCode: string;
      name: string;
      tradingTermsId?: string | null;
    },
    dto: {
      invoiceDate?: string;
      notes?: string;
      lines: Array<{
        projectTaskId?: string;
        description: string;
        quantity: number;
        pricePerUnit: number;
        amount?: number;
        discountPercentage?: number;
        taxCategoryId?: string;
        productId?: string;
        glAccountId?: string;
        projectLedgerEntryId?: string;
      }>;
    },
    actor: string,
    tx?: DrizzleDB,
  ) {
    const execute = async (db: DrizzleDB) => {
      if (!dto.lines || dto.lines.length === 0) {
        throw new BadRequestException('Cannot create invoice with no lines.');
      }

      let customerName = 'Unknown Customer';
      let customerArAccountId: string | null = null;
      let customerRevenueAccountId: string | null = null;
      let customerCostCenterId: string | null = null;
      let customerActivityId: string | null = null;
      let customerTermType: string | null = null;
      let customerTermDays: number | null = null;
      let customerTermDescription: string | null = null;
      let earlyPaymentDiscount: string | null = null;
      let earlyPaymentDiscountDays: number | null = null;

      if (project.customerId) {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            project.customerId,
          );

        const custRows = await db
          .select({
            externalId: customers.externalId,
            name: organizations.name,
            defaultArAccountId: customerGroups.defaultArAccountId,
            defaultRevenueAccountId: customerGroups.defaultRevenueAccountId,
            defaultCostCenterId: customerGroups.defaultCostCenterId,
            defaultActivityId: customerGroups.defaultActivityId,
            creditLimit: customers.creditLimit,
            isOnCreditHold: customers.isOnCreditHold,
            tradingTermsId: customers.tradingTermsId,
            earlyPaymentDiscount: customers.earlyPaymentDiscount,
            earlyPaymentDiscountDays: customers.earlyPaymentDiscountDays,
            groupCreditLimit: customerGroups.creditLimit,
            groupIsOnCreditHold: customerGroups.isOnCreditHold,
            groupTradingTermsId: customerGroups.tradingTermsId,
            groupEarlyPaymentDiscount: customerGroups.earlyPaymentDiscount,
            groupEarlyPaymentDiscountDays:
              customerGroups.earlyPaymentDiscountDays,
          })
          .from(customers)
          .leftJoin(
            customerGroups,
            eq(customers.customerGroupId, customerGroups.customerGroupId),
          )
          .leftJoin(
            organizations,
            eq(customers.organizationId, organizations.organizationId),
          )
          .where(
            isUuid
              ? eq(customers.customerId, project.customerId)
              : eq(customers.externalId, project.customerId),
          )
          .limit(1);

        if (custRows.length > 0) {
          customerName = custRows[0].name || 'Unknown Customer';
          customerArAccountId = custRows[0].defaultArAccountId;
          customerRevenueAccountId = custRows[0].defaultRevenueAccountId;
          customerCostCenterId = custRows[0].defaultCostCenterId;
          customerActivityId = custRows[0].defaultActivityId;

          const effectiveEarlyPaymentDiscount =
            resolveEffectiveEarlyPaymentDiscount({
              earlyPaymentDiscount: custRows[0].earlyPaymentDiscount,
              earlyPaymentDiscountDays: custRows[0].earlyPaymentDiscountDays,
              customerGroup: {
                earlyPaymentDiscount: custRows[0].groupEarlyPaymentDiscount,
                earlyPaymentDiscountDays:
                  custRows[0].groupEarlyPaymentDiscountDays,
              },
            });
          earlyPaymentDiscount =
            effectiveEarlyPaymentDiscount.earlyPaymentDiscount;
          earlyPaymentDiscountDays =
            effectiveEarlyPaymentDiscount.earlyPaymentDiscountDays;

          let effectiveTermsId = project.tradingTermsId;
          if (!effectiveTermsId) {
            effectiveTermsId = resolveEffectiveTradingTermsId({
              creditLimit: custRows[0].creditLimit,
              isOnCreditHold: custRows[0].isOnCreditHold ?? false,
              tradingTermsId: custRows[0].tradingTermsId,
              customerGroup: {
                creditLimit: custRows[0].groupCreditLimit,
                isOnCreditHold: custRows[0].groupIsOnCreditHold ?? false,
                tradingTermsId: custRows[0].groupTradingTermsId,
              },
              systemDefaultCustomerTermsId:
                this.appConfig.getAppSettingsRaw()?.defaultCustomerTermsId,
            });
          }

          if (effectiveTermsId) {
            const [term] = await db
              .select()
              .from(tradingTerms)
              .where(eq(tradingTerms.tradingTermsId, effectiveTermsId))
              .limit(1);
            if (term) {
              customerTermType = term.type as
                | 'net'
                | 'end_of_month'
                | 'cash_on_delivery';
              customerTermDays = term.days;
              customerTermDescription = `${term.code} - ${term.description}`;
            }
          }
        }
      }

      const invoiceNumber = await generateInvoiceNumber(db);
      const invoiceDate = dto.invoiceDate
        ? new Date(dto.invoiceDate)
        : new Date();
      let dueDate = new Date(invoiceDate);
      if (customerTermType && customerTermDays !== null) {
        dueDate = calculateDueDate(
          invoiceDate,
          customerTermType,
          customerTermDays,
        );
      }

      let rawTotal = 0;
      let rawTax = 0;
      const invoiceLineValues = [];

      const revenueGroups = new Map<
        string,
        {
          customerId: string;
          amount: number;
          costCenterId: string | null;
          activityId: string | null;
        }
      >();
      let defaultRevenue = 0;
      let defaultRevenueCostCenterId: string | null = null;
      let defaultRevenueActivityId: string | null = null;
      const taxGroups = new Map<string, number>();

      const globalSettings = await this.glService.getSettings(db);
      const sysDefaultRevAcct = globalSettings?.defaultRevenueAccountId || null;
      const sysDefaultCC = this.appConfig.defaultCostCenterId() || null;
      const sysDefaultAct = this.appConfig.defaultActivityId() || null;

      const productIds = dto.lines
        .map((l) => l.productId)
        .filter(Boolean) as string[];
      const productMetaMap = new Map<
        string,
        {
          revenueAccountId: string | null;
          costCenterId: string | null;
          activityId: string | null;
        }
      >();

      if (productIds.length > 0) {
        const prodRows = await db
          .select({
            productId: coreProducts.productId,
            productRevenueAccountId: productGroups.defaultRevenueAccountId,
            productCostCenterId: productGroups.defaultCostCenterId,
            productActivityId: productGroups.defaultActivityId,
          })
          .from(coreProducts)
          .leftJoin(
            productGroups,
            eq(coreProducts.productGroupId, productGroups.productGroupId),
          )
          .where(
            sql`${coreProducts.productId} IN (${sql.join(
              productIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );

        for (const pr of prodRows) {
          productMetaMap.set(pr.productId, {
            revenueAccountId: pr.productRevenueAccountId,
            costCenterId: pr.productCostCenterId,
            activityId: pr.productActivityId,
          });
        }
      }

      for (const line of dto.lines) {
        const qty = line.quantity || 1;
        const price = line.pricePerUnit || 0;

        let taxRate = 0;
        let taxAccountId: string | null = null;
        if (line.taxCategoryId) {
          try {
            const cat = await this.taxService.getById(line.taxCategoryId);
            taxRate = parseFloat(cat.rate || '0');
            taxAccountId = cat.salesGlAccountId || null;
          } catch (err: unknown) {
            const isNotFound =
              err instanceof NotFoundException ||
              (typeof err === 'object' &&
                err !== null &&
                'status' in err &&
                (err as { status: number }).status === 404);
            if (isNotFound) {
              taxRate = 0;
              taxAccountId = null;
            } else {
              throw err;
            }
          }
        }

        const disc =
          typeof line.discountPercentage === 'number'
            ? line.discountPercentage
            : 0;

        const pricing = computeLinePrice({
          quantity: qty,
          pricePerUnit: price,
          discountPercentage: disc,
          taxRate,
        });

        const lineAmount =
          typeof line.amount === 'number' ? line.amount : pricing.amount;

        rawTotal += lineAmount;
        const computedTax = pricing.tax;
        rawTax += computedTax;

        if (computedTax > 0) {
          const effectiveTaxKey = taxAccountId || 'fallback';
          taxGroups.set(
            effectiveTaxKey,
            (taxGroups.get(effectiveTaxKey) || 0) + computedTax,
          );
        }

        const prodMeta = line.productId
          ? productMetaMap.get(line.productId)
          : undefined;

        const {
          accountId: lineRevAcctId,
          costCenterId: lineCostCenterId,
          activityId: lineActivityId,
        } = resolveGlDimensions(
          {
            accountId: line.glAccountId || prodMeta?.revenueAccountId,
            costCenterId: prodMeta?.costCenterId,
            activityId: prodMeta?.activityId,
          },
          {
            accountId: customerRevenueAccountId,
            costCenterId: customerCostCenterId,
            activityId: customerActivityId,
          },
          {
            defaultAccountId: sysDefaultRevAcct,
            defaultCostCenterId: sysDefaultCC,
            defaultActivityId: sysDefaultAct,
          },
        );

        if (lineRevAcctId) {
          const compositeKey = `${lineRevAcctId}|${lineCostCenterId || ''}|${lineActivityId || ''}`;
          const existing = revenueGroups.get(compositeKey);
          if (existing) {
            existing.amount += lineAmount;
          } else {
            revenueGroups.set(compositeKey, {
              customerId: lineRevAcctId,
              amount: lineAmount,
              costCenterId: lineCostCenterId,
              activityId: lineActivityId,
            });
          }
        } else {
          defaultRevenue += lineAmount;
          defaultRevenueCostCenterId =
            defaultRevenueCostCenterId || lineCostCenterId;
          defaultRevenueActivityId = defaultRevenueActivityId || lineActivityId;
        }

        const resolvedRevAcctId = lineRevAcctId || sysDefaultRevAcct;

        invoiceLineValues.push({
          salesOrderLineId: null,
          description: line.description,
          productId: line.productId || null,
          glAccountId: resolvedRevAcctId || null,
          projectLedgerEntryId: line.projectLedgerEntryId || null,
          quantityInvoiced: String(qty),
          pricePerUnit: String(price),
          discountPercentage: String(disc),
          taxAmount: String(computedTax),
          taxCategoryId: line.taxCategoryId || null,
          amount: String(lineAmount),
        });
      }

      const totalAmount = rawTotal;
      const taxAmount = rawTax;
      const combinedTotal = totalAmount + taxAmount;

      const fx = await getExchangeRateForCurrency(
        db,
        project.currencyCode,
        invoiceDate,
      );
      const baseTotalAmount = (combinedTotal * fx.rate).toFixed(2);

      const invoiceId = randomUUID();
      const [invoice] = await db
        .insert(salesInvoices)
        .values({
          invoiceId,
          invoiceNumber,
          projectId: project.projectId,
          salesOrderId: null,
          customerId: project.customerId,
          customerNameDisplay: customerName,
          totalAmount: combinedTotal.toFixed(2),
          outstandingAmount: combinedTotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          baseTotalAmount: baseTotalAmount,
          baseOutstandingAmount: baseTotalAmount,
          currencyCode: project.currencyCode,
          exchangeRate: fx.rate.toString(),
          stateCode: SALES_INVOICE_STATE.DRAFT,
          notes: dto.notes,
          termsDescription: customerTermDescription,
          invoiceDate,
          dueDate,
          earlyPaymentDiscount,
          earlyPaymentDiscountDays,
          createdBy: actor,
        })
        .returning();

      const invoicedInvoice = await changeSalesInvoiceStateHelper(
        this.db,
        this.glService,
        this.logger,
        invoice.invoiceId,
        SALES_INVOICE_STATE.INVOICED,
        actor,
        db,
      );

      const preparedLines = invoiceLineValues.map((l) => ({
        ...l,
        invoiceId: invoice.invoiceId,
      }));
      const insertedLines = await db
        .insert(salesInvoiceLines)
        .values(preparedLines)
        .returning();

      // Post GL journal entry
      const settings = await this.glService.getSettings(db);
      const effectiveArAccountId =
        customerArAccountId || settings?.defaultArAccountId;

      if (!effectiveArAccountId) {
        throw new BadRequestException(
          'Cannot create invoice: Accounts Receivable account (defaultArAccountId) is not configured in GL Settings.',
        );
      }

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
          ? await db
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

      const idToCode = new Map(
        acctRows.map((a) => [a.glAccountId, a.accountCode]),
      );

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
      const glLines: any[] = [
        {
          accountCode: arCode,
          debit: combinedTotal * fx.rate,
          credit: 0,
          foreignCurrency: project.currencyCode,
          foreignDebit: combinedTotal,
          foreignCredit: 0,
          memo: `AR: ${invoiceNumber} (Project ${project.projectNumber})`,
          partyType: 'customer',
          partyId: project.customerId,
          costCenterId:
            customerCostCenterId ||
            this.appConfig.defaultCostCenterId() ||
            undefined,
          activityId:
            customerActivityId ||
            this.appConfig.defaultActivityId() ||
            undefined,
        },
      ];

      for (const group of revenueGroups.values()) {
        let code = idToCode.get(group.customerId);
        if (!code && defaultRevenueCode) {
          code = defaultRevenueCode;
        }

        if (!code && group.amount > 0) {
          throw new BadRequestException(
            `Cannot create invoice: Revenue account '${group.customerId}' not found in Chart of Accounts.`,
          );
        }

        if (code && group.amount > 0) {
          glLines.push({
            accountCode: code,
            debit: 0,
            credit: group.amount * fx.rate,
            foreignCurrency: project.currencyCode,
            foreignDebit: 0,
            foreignCredit: group.amount,
            memo: `Revenue: ${invoiceNumber} (Project ${project.projectNumber})`,
            costCenterId: group.costCenterId || undefined,
            activityId: group.activityId || undefined,
          });
        }
      }

      if (defaultRevenue > 0) {
        if (!defaultRevenueCode) {
          throw new BadRequestException(
            'Cannot create invoice: Default Revenue account is not configured in GL Settings.',
          );
        }

        glLines.push({
          accountCode: defaultRevenueCode,
          debit: 0,
          credit: defaultRevenue * fx.rate,
          foreignCurrency: project.currencyCode,
          foreignDebit: 0,
          foreignCredit: defaultRevenue,
          memo: `Revenue: ${invoiceNumber} (Default)`,
          costCenterId: defaultRevenueCostCenterId || undefined,
          activityId: defaultRevenueActivityId || undefined,
        });
      }

      for (const [acctId, taxAmt] of taxGroups.entries()) {
        if (taxAmt > 0) {
          let effectiveTaxCode =
            acctId !== 'fallback' ? idToCode.get(acctId) : taxCode;
          if (!effectiveTaxCode && taxCode) {
            effectiveTaxCode = taxCode;
          }

          if (!effectiveTaxCode) {
            throw new BadRequestException(
              'Cannot create invoice: Sales Tax account is not configured in GL Settings.',
            );
          }

          glLines.push({
            accountCode: effectiveTaxCode,
            debit: 0,
            credit: taxAmt * fx.rate,
            foreignCurrency: project.currencyCode,
            foreignDebit: 0,
            foreignCredit: taxAmt,
            memo: `GST: ${invoiceNumber}`,
          });
        }
      }

      if (combinedTotal > 0) {
        if (glLines.length < 2) {
          throw new BadRequestException(
            'Cannot create invoice: Failed to construct balancing GL journal entry lines.',
          );
        }

        await this.glService.postJournalEntry(
          glLines,
          {
            sourceType: JOURNAL_ENTRY_SOURCE_TYPE.SALES_INVOICE,
            sourceId: invoice.invoiceId,
            memo: `Sales invoice ${invoiceNumber} for project ${project.projectNumber}`,
            actor,
          },
          db,
        );

        this.logger.log(
          `GL journal posted for project sales invoice ${invoiceNumber}`,
        );
      }

      await emitEvent(db, {
        entityType: EntityType.SALES_INVOICE,
        entityId: invoice.invoiceId,
        eventType: EventType.CREATED,
        entityDisplayName: invoice.invoiceNumber,
        payload: {
          action: 'project_invoice_created',
          invoiceId: invoice.invoiceId,
          invoiceNumber,
          projectId: project.projectId,
          projectNumber: project.projectNumber,
          customerId: project.customerId,
          customerName,
          totalAmount: combinedTotal,
          currency: project.currencyCode,
        },
        actor,
      });

      return {
        ...invoicedInvoice,
        lines: insertedLines,
      };
    };

    try {
      if (tx) {
        return await execute(tx);
      }
      return await this.db.transaction(execute);
    } catch (err) {
      this.logger.error('CREATE PROJECT INVOICE FAILED:', err);
      throw err;
    }
  }
}
