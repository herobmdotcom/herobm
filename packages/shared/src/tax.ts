/**
 * Centralised Tax Calculation & Statutory Reporting Engine
 *
 * Single source of truth for pure tax balance calculations,
 * category scheduling, and international statutory return mappings.
 */

export type TaxReportType =
  | 'generic'
  | 'au_bas'
  | 'uk_vat'
  | 'sg_gst'
  | 'nz_gst'
  | 'de_ustva'
  | 'us_sales_tax';

export type TaxNetStatus = 'payable' | 'refundable' | 'zero';

export interface RawTaxCategoryInput {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate?: string | number | null;
  salesGlAccountId?: string | null;
  purchaseGlAccountId?: string | null;
}

export interface CalculatedTaxCategory {
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: number;
  salesBase: number;
  outputTax: number;
  purchaseBase: number;
  inputTax: number;
  netTax: number;
}

export interface StatutoryReportBox {
  id: string;
  code: string;
  description: string;
  amount: number;
  section?: string;
}

export interface TaxSummaryCalculationInput {
  salesTaxByAccount: Map<string, number> | Record<string, number>;
  purchaseTaxByAccount: Map<string, number> | Record<string, number>;
  totalNetSales: number;
  totalNetPurchases?: number;
  defaultSalesTaxAccountId?: string | null;
  categories: RawTaxCategoryInput[];
  currencyCode?: string;
}

export interface CalculatedTaxSummary {
  totalOutputTax: number;
  totalInputTax: number;
  netTaxLiability: number;
  netStatus: TaxNetStatus;
  totalGrossSales: number;
  totalNetSales: number;
  taxableSales: number;
  exemptSales: number;
  totalNetPurchases: number;
  taxablePurchases: number;
  currencyCode: string;
  categories: CalculatedTaxCategory[];
}

/**
 * Helper to round to 2 decimal places with floating point safety.
 */
function round2(val: number): number {
  return Number(Math.round(Number(val + 'e2')) + 'e-2');
}

/**
 * Resolve net position and status from total output and input taxes.
 */
export function calculateTaxNetPosition(
  outputTax: number,
  inputTax: number,
): { netTaxLiability: number; netStatus: TaxNetStatus } {
  const netTaxLiability = round2(outputTax - inputTax);
  const netStatus: TaxNetStatus =
    netTaxLiability > 0.001
      ? 'payable'
      : netTaxLiability < -0.001
        ? 'refundable'
        : 'zero';

  return { netTaxLiability, netStatus };
}

/**
 * Compute the complete generic tax summary metrics and category schedule.
 * Pure function with deterministic output.
 */
export function calculateGenericTaxSummary(
  input: TaxSummaryCalculationInput,
): CalculatedTaxSummary {
  const getAmount = (
    mapOrObj: Map<string, number> | Record<string, number>,
    key: string,
  ): number => {
    if (mapOrObj instanceof Map) {
      return mapOrObj.get(key) || 0;
    }
    return (mapOrObj as Record<string, number>)[key] || 0;
  };

  const getSum = (
    mapOrObj: Map<string, number> | Record<string, number>,
  ): number => {
    if (mapOrObj instanceof Map) {
      let sum = 0;
      for (const v of mapOrObj.values()) sum += v;
      return sum;
    }
    return Object.values(mapOrObj).reduce((sum, v) => sum + (v || 0), 0);
  };

  const totalOutputTax = round2(getSum(input.salesTaxByAccount));
  const totalInputTax = round2(getSum(input.purchaseTaxByAccount));
  const { netTaxLiability, netStatus } = calculateTaxNetPosition(
    totalOutputTax,
    totalInputTax,
  );

  const totalNetSales = round2(input.totalNetSales);
  const totalGrossSales = round2(totalNetSales + totalOutputTax);
  const totalNetPurchases = round2(input.totalNetPurchases || 0);

  const categories: CalculatedTaxCategory[] = [];
  let aggregatedTaxableSales = 0;
  let aggregatedTaxablePurchases = 0;

  for (const cat of input.categories) {
    const rateNum = parseFloat(String(cat.rate || '0')) || 0;
    const catSalesTax = cat.salesGlAccountId
      ? getAmount(input.salesTaxByAccount, cat.salesGlAccountId)
      : 0;
    const catPurchaseTax = cat.purchaseGlAccountId
      ? getAmount(input.purchaseTaxByAccount, cat.purchaseGlAccountId)
      : 0;

    const salesBase =
      rateNum > 0 ? round2(catSalesTax / (rateNum / 100)) : 0;
    const purchaseBase =
      rateNum > 0 ? round2(catPurchaseTax / (rateNum / 100)) : 0;

    if (cat.type === 'tax_applies') {
      aggregatedTaxableSales += salesBase;
      aggregatedTaxablePurchases += purchaseBase;
    }

    categories.push({
      taxCategoryId: cat.taxCategoryId,
      code: cat.code,
      title: cat.title,
      type: cat.type,
      rate: rateNum,
      salesBase,
      outputTax: round2(catSalesTax),
      purchaseBase,
      inputTax: round2(catPurchaseTax),
      netTax: round2(catSalesTax - catPurchaseTax),
    });
  }

  // Fallback to default sales tax account if unmapped
  if (input.defaultSalesTaxAccountId) {
    const fallbackOutputTax = getAmount(
      input.salesTaxByAccount,
      input.defaultSalesTaxAccountId,
    );
    if (
      fallbackOutputTax > 0 &&
      !input.categories.some(
        (c) => c.salesGlAccountId === input.defaultSalesTaxAccountId,
      )
    ) {
      aggregatedTaxableSales = Math.max(
        aggregatedTaxableSales,
        totalNetSales > 0 ? totalNetSales : 0,
      );
    }
  }

  const taxableSales = round2(
    Math.min(
      Math.max(0, aggregatedTaxableSales),
      Math.max(0, totalNetSales),
    ),
  );
  const exemptSales = round2(Math.max(0, totalNetSales - taxableSales));
  const taxablePurchases = round2(
    aggregatedTaxablePurchases > 0
      ? aggregatedTaxablePurchases
      : totalNetPurchases,
  );

  return {
    totalOutputTax,
    totalInputTax,
    netTaxLiability,
    netStatus,
    totalGrossSales,
    totalNetSales,
    taxableSales,
    exemptSales,
    totalNetPurchases,
    taxablePurchases,
    currencyCode: input.currencyCode ?? 'USD', // base_currency fallback
    categories,
  };
}

/**
 * Returns title and subtitle metadata for a given report template.
 */
export function getTaxReportMetadata(reportType: TaxReportType = 'generic'): {
  title: string;
  subtitle: string;
} {
  switch (reportType) {
    case 'au_bas':
      return {
        title: 'ATO BAS Report',
        subtitle:
          'Australian Taxation Office — Business Activity Statement Summary',
      };
    case 'uk_vat':
      return {
        title: 'HMRC VAT Return',
        subtitle: 'HM Revenue & Customs — VAT 100 Return',
      };
    case 'sg_gst':
      return {
        title: 'IRAS GST Return',
        subtitle:
          'Inland Revenue Authority of Singapore — GST Form 5 (F5)',
      };
    case 'nz_gst':
      return {
        title: 'Inland Revenue GST Return',
        subtitle: 'New Zealand Inland Revenue — GST 101 Return',
      };
    case 'de_ustva':
      return {
        title: 'Umsatzsteuer-Voranmeldung (USt-VA)',
        subtitle: 'Bundesministerium der Finanzen — USt-VA Formular',
      };
    case 'us_sales_tax':
      return {
        title: 'Sales & Use Tax Summary',
        subtitle:
          'United States State & Local Sales and Use Tax Reporting',
      };
    default:
      return {
        title: 'Generic Tax Summary',
        subtitle: 'International Tax Balances & VAT/GST Summary',
      };
  }
}

/**
 * Pure function mapping calculated generic tax summary into official statutory box rows.
 */
export function buildStatutoryReportBoxes(
  reportType: TaxReportType,
  summary: CalculatedTaxSummary,
): StatutoryReportBox[] | undefined {
  if (reportType === 'generic') {
    return undefined;
  }

  const {
    totalGrossSales,
    totalOutputTax,
    totalInputTax,
    totalNetSales,
    totalNetPurchases,
    taxableSales,
    exemptSales,
    taxablePurchases,
    categories,
  } = summary;

  switch (reportType) {
    case 'au_bas': {
      const roundedGrossSales = Math.round(totalGrossSales);
      const roundedGstSales = Math.round(totalOutputTax);
      const roundedGstPurchases = Math.round(totalInputTax);
      const w1 = 0;
      const w2 = 0;
      const totalOwedToAto = roundedGstSales + w2;
      const totalOwedByAto = roundedGstPurchases;
      const netAmount = Math.abs(totalOwedToAto - totalOwedByAto);

      return [
        {
          id: 'G1',
          code: 'G1',
          description: 'Total sales (GST inclusive)',
          amount: roundedGrossSales,
          section: 'GST',
        },
        {
          id: '1A',
          code: '1A',
          description: 'GST on sales',
          amount: roundedGstSales,
          section: 'GST',
        },
        {
          id: '1B',
          code: '1B',
          description: 'GST on purchases',
          amount: roundedGstPurchases,
          section: 'GST',
        },
        {
          id: 'W1',
          code: 'W1',
          description: 'Total salary, wages and other payments',
          amount: w1,
          section: 'PAYG Withholding',
        },
        {
          id: 'W2',
          code: 'W2',
          description: 'Amounts withheld from payments',
          amount: w2,
          section: 'PAYG Withholding',
        },
        {
          id: '8A',
          code: '8A',
          description: 'Total owed to ATO',
          amount: totalOwedToAto,
          section: 'Summary',
        },
        {
          id: '8B',
          code: '8B',
          description: 'Total owed by ATO',
          amount: totalOwedByAto,
          section: 'Summary',
        },
        {
          id: '9',
          code: '9',
          description: 'Net amount',
          amount: netAmount,
          section: 'Summary',
        },
      ];
    }

    case 'uk_vat': {
      const box1 = round2(totalOutputTax);
      const box2 = 0;
      const box3 = round2(box1 + box2);
      const box4 = round2(totalInputTax);
      const box5 = round2(Math.abs(box3 - box4));
      const box6 = Math.round(totalNetSales);
      const box7 = Math.round(totalNetPurchases);
      const box8 = 0;
      const box9 = 0;

      return [
        {
          id: 'BOX_1',
          code: 'Box 1',
          description: 'VAT due in the period on sales and other outputs',
          amount: box1,
          section: 'VAT Due',
        },
        {
          id: 'BOX_2',
          code: 'Box 2',
          description:
            'VAT due in the period on acquisitions from other EU member states / Reverse charge',
          amount: box2,
          section: 'VAT Due',
        },
        {
          id: 'BOX_3',
          code: 'Box 3',
          description: 'Total VAT due (Box 1 + Box 2)',
          amount: box3,
          section: 'VAT Due',
        },
        {
          id: 'BOX_4',
          code: 'Box 4',
          description: 'VAT reclaimed in the period on sales and other inputs',
          amount: box4,
          section: 'VAT Reclaimed',
        },
        {
          id: 'BOX_5',
          code: 'Box 5',
          description:
            'Net VAT to be paid to HMRC or reclaimed (Box 3 - Box 4)',
          amount: box5,
          section: 'Net VAT',
        },
        {
          id: 'BOX_6',
          code: 'Box 6',
          description:
            'Total value of sales and all other outputs excluding any VAT',
          amount: box6,
          section: 'Turnover',
        },
        {
          id: 'BOX_7',
          code: 'Box 7',
          description:
            'Total value of purchases and all other inputs excluding any VAT',
          amount: box7,
          section: 'Turnover',
        },
        {
          id: 'BOX_8',
          code: 'Box 8',
          description:
            'Total value of all supplies of goods to EC member states',
          amount: box8,
          section: 'Cross Border',
        },
        {
          id: 'BOX_9',
          code: 'Box 9',
          description:
            'Total value of all acquisitions of goods from EC member states',
          amount: box9,
          section: 'Cross Border',
        },
      ];
    }

    case 'sg_gst': {
      const stdSupplies = Math.round(taxableSales);
      const zeroSupplies = Math.round(exemptSales);
      const exemptSupplies = 0;
      const totalSupplies = stdSupplies + zeroSupplies + exemptSupplies;
      const taxablePurchasesAmt = Math.round(taxablePurchases);
      const outputTaxDue = Math.round(totalOutputTax);
      const inputTaxClaimed = Math.round(totalInputTax);
      const netGst = Math.abs(outputTaxDue - inputTaxClaimed);

      return [
        {
          id: 'BOX_1',
          code: 'Box 1',
          description: 'Total value of standard-rated supplies',
          amount: stdSupplies,
          section: 'Supplies',
        },
        {
          id: 'BOX_2',
          code: 'Box 2',
          description: 'Total value of zero-rated supplies',
          amount: zeroSupplies,
          section: 'Supplies',
        },
        {
          id: 'BOX_3',
          code: 'Box 3',
          description: 'Total value of exempt supplies',
          amount: exemptSupplies,
          section: 'Supplies',
        },
        {
          id: 'BOX_4',
          code: 'Box 4',
          description: 'Total supplies (Box 1 + Box 2 + Box 3)',
          amount: totalSupplies,
          section: 'Supplies',
        },
        {
          id: 'BOX_5',
          code: 'Box 5',
          description: 'Total value of taxable purchases',
          amount: taxablePurchasesAmt,
          section: 'Purchases',
        },
        {
          id: 'BOX_6',
          code: 'Box 6',
          description: 'Output tax due',
          amount: outputTaxDue,
          section: 'Tax',
        },
        {
          id: 'BOX_7',
          code: 'Box 7',
          description: 'Input tax and refunds claimed',
          amount: inputTaxClaimed,
          section: 'Tax',
        },
        {
          id: 'BOX_8',
          code: 'Box 8',
          description: 'Net GST to be paid to IRAS / (claimed from IRAS)',
          amount: netGst,
          section: 'Tax',
        },
      ];
    }

    case 'nz_gst': {
      const box5 = Math.round(totalGrossSales);
      const box6 = Math.round(exemptSales);
      const box7 = Math.round(taxableSales);
      const box8 = Math.round(totalOutputTax);
      const box9 = Math.round(totalNetPurchases + totalInputTax);
      const box11 = Math.round(totalInputTax);
      const box12 = Math.abs(box8 - box11);

      return [
        {
          id: 'BOX_5',
          code: 'Box 5',
          description: 'Total sales and income (including GST)',
          amount: box5,
          section: 'Sales',
        },
        {
          id: 'BOX_6',
          code: 'Box 6',
          description: 'Zero-rated supplies included in Box 5',
          amount: box6,
          section: 'Sales',
        },
        {
          id: 'BOX_7',
          code: 'Box 7',
          description: 'Total taxable supplies (Box 5 minus Box 6)',
          amount: box7,
          section: 'Sales',
        },
        {
          id: 'BOX_8',
          code: 'Box 8',
          description: 'GST on sales and income',
          amount: box8,
          section: 'GST on Sales',
        },
        {
          id: 'BOX_9',
          code: 'Box 9',
          description: 'Total purchases and expenses (including GST)',
          amount: box9,
          section: 'Purchases',
        },
        {
          id: 'BOX_11',
          code: 'Box 11',
          description: 'GST on purchases and expenses',
          amount: box11,
          section: 'GST on Purchases',
        },
        {
          id: 'BOX_12',
          code: 'Box 12',
          description: 'Net GST refund or payment (Box 8 minus Box 11)',
          amount: box12,
          section: 'Calculation',
        },
      ];
    }

    case 'de_ustva': {
      const cat19 = categories.find((c) => Math.round(c.rate) === 19);
      const cat7 = categories.find((c) => Math.round(c.rate) === 7);
      const zg81Base = cat19 ? cat19.salesBase : Math.round(taxableSales);
      const zg81Tax = cat19 ? cat19.outputTax : Math.round(totalOutputTax);
      const zg86Base = cat7 ? cat7.salesBase : 0;
      const zg86Tax = cat7 ? cat7.outputTax : 0;
      const zg41 = Math.round(exemptSales);
      const zg66 = Math.round(totalInputTax);
      const zg83 = Math.abs(Math.round(totalOutputTax) - zg66);

      return [
        {
          id: 'ZG_81',
          code: 'Zg 81',
          description:
            'Steuerpflichtige Umsätze zum Steuersatz von 19 % (Bemessungsgrundlage)',
          amount: Math.round(zg81Base),
          section: 'Lieferungen & Leistungen',
        },
        {
          id: 'ZG_81_TAX',
          code: 'Zg 81 Steuer',
          description: 'Steuer zu 19 %',
          amount: Math.round(zg81Tax),
          section: 'Lieferungen & Leistungen',
        },
        {
          id: 'ZG_86',
          code: 'Zg 86',
          description:
            'Steuerpflichtige Umsätze zum ermäßigten Steuersatz von 7 % (Bemessungsgrundlage)',
          amount: Math.round(zg86Base),
          section: 'Lieferungen & Leistungen',
        },
        {
          id: 'ZG_86_TAX',
          code: 'Zg 86 Steuer',
          description: 'Steuer zu 7 %',
          amount: Math.round(zg86Tax),
          section: 'Lieferungen & Leistungen',
        },
        {
          id: 'ZG_41',
          code: 'Zg 41',
          description: 'Steuerfreie Umsätze mit Vorsteuerabzug',
          amount: zg41,
          section: 'Steuerfreie Umsätze',
        },
        {
          id: 'ZG_66',
          code: 'Zg 66',
          description:
            'Abziehbare Vorsteuerbeträge (Input VAT auf Einkäufe)',
          amount: zg66,
          section: 'Abziehbare Vorsteuer',
        },
        {
          id: 'ZG_83',
          code: 'Zg 83',
          description:
            'Verbleibende Umsatzsteuer-Vorauszahlung / Erstattungsbetrag',
          amount: zg83,
          section: 'Abrechnung',
        },
      ];
    }

    case 'us_sales_tax': {
      const grossSales = Math.round(totalGrossSales);
      const nonTaxable = Math.round(exemptSales);
      const taxable = Math.round(taxableSales);
      const taxCollected = Math.round(totalOutputTax);
      const useTax = 0;
      const totalDue = taxCollected + useTax;

      return [
        {
          id: 'GROSS_SALES',
          code: 'Line 1',
          description: 'Total Gross Sales & Receipts',
          amount: grossSales,
          section: 'Gross Sales',
        },
        {
          id: 'NON_TAXABLE',
          code: 'Line 2',
          description: 'Exempt & Non-Taxable Sales / Deductions',
          amount: nonTaxable,
          section: 'Deductions',
        },
        {
          id: 'TAXABLE_SALES',
          code: 'Line 3',
          description: 'Net Taxable Sales (Line 1 minus Line 2)',
          amount: taxable,
          section: 'Taxable Sales',
        },
        {
          id: 'TAX_COLLECTED',
          code: 'Line 4',
          description: 'Total Sales Tax Collected (Output Tax)',
          amount: taxCollected,
          section: 'Tax Due',
        },
        {
          id: 'USE_TAX',
          code: 'Line 5',
          description: 'Consumer Use Tax Payable on Purchases',
          amount: useTax,
          section: 'Tax Due',
        },
        {
          id: 'TOTAL_DUE',
          code: 'Line 6',
          description: 'Total Sales & Use Tax Due (Line 4 + Line 5)',
          amount: totalDue,
          section: 'Total Due',
        },
      ];
    }
  }
}
