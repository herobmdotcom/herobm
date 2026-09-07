import {
  calculateTaxNetPosition,
  calculateGenericTaxSummary,
  buildStatutoryReportBoxes,
  getTaxReportMetadata,
} from './tax';

describe('Shared Tax Calculation Engine', () => {
  describe('calculateTaxNetPosition', () => {
    it('should correctly calculate net payable position', () => {
      const result = calculateTaxNetPosition(1000, 200);
      expect(result.netTaxLiability).toBe(800);
      expect(result.netStatus).toBe('payable');
    });

    it('should correctly calculate refund claimable position', () => {
      const result = calculateTaxNetPosition(200, 1000);
      expect(result.netTaxLiability).toBe(-800);
      expect(result.netStatus).toBe('refundable');
    });

    it('should correctly calculate zero position', () => {
      const result = calculateTaxNetPosition(500, 500);
      expect(result.netTaxLiability).toBe(0);
      expect(result.netStatus).toBe('zero');
    });
  });

  describe('calculateGenericTaxSummary', () => {
    it('should compute complete generic tax summary from account maps and categories', () => {
      const salesMap = new Map<string, number>([
        ['sales-tax-1', 1000.49],
      ]);
      const purchaseMap = new Map<string, number>([
        ['purchase-tax-1', 200.51],
      ]);

      const result = calculateGenericTaxSummary({
        salesTaxByAccount: salesMap,
        purchaseTaxByAccount: purchaseMap,
        totalNetSales: 8000,
        totalNetPurchases: 4000,
        defaultSalesTaxAccountId: 'sales-tax-1',
        categories: [
          {
            taxCategoryId: 'cat-1',
            code: 'GST_10',
            title: 'Standard GST 10%',
            type: 'tax_applies',
            rate: 10,
            salesGlAccountId: 'sales-tax-1',
            purchaseGlAccountId: 'purchase-tax-1',
          },
        ],
      });

      expect(result.totalOutputTax).toBe(1000.49);
      expect(result.totalInputTax).toBe(200.51);
      expect(result.netTaxLiability).toBe(799.98);
      expect(result.netStatus).toBe('payable');
      expect(result.totalNetSales).toBe(8000);
      expect(result.totalGrossSales).toBe(9000.49);
      expect(result.categories.length).toBe(1);
      expect(result.categories[0].salesBase).toBe(10004.9);
      expect(result.categories[0].outputTax).toBe(1000.49);
      expect(result.categories[0].purchaseBase).toBe(2005.1);
      expect(result.categories[0].inputTax).toBe(200.51);
    });
  });

  describe('buildStatutoryReportBoxes', () => {
    const mockSummary = calculateGenericTaxSummary({
      salesTaxByAccount: new Map([['tax', 1000.49]]),
      purchaseTaxByAccount: new Map([['tax', 200.51]]),
      totalNetSales: 8000,
      totalNetPurchases: 4000,
      categories: [
        {
          taxCategoryId: '19',
          code: 'VAT_19',
          title: 'VAT 19%',
          type: 'tax_applies',
          rate: 19,
          salesGlAccountId: 'tax',
          purchaseGlAccountId: 'tax',
        },
      ],
    });

    it('should generate Australian ATO BAS boxes', () => {
      const boxes = buildStatutoryReportBoxes('au_bas', mockSummary);
      expect(boxes).toBeDefined();
      expect(boxes?.find((b) => b.id === 'G1')?.amount).toBe(9000);
      expect(boxes?.find((b) => b.id === '1A')?.amount).toBe(1000);
      expect(boxes?.find((b) => b.id === '1B')?.amount).toBe(201);
      expect(boxes?.find((b) => b.id === '9')?.amount).toBe(799);
    });

    it('should generate UK HMRC VAT return boxes', () => {
      const boxes = buildStatutoryReportBoxes('uk_vat', mockSummary);
      expect(boxes).toBeDefined();
      expect(boxes?.find((b) => b.id === 'BOX_1')?.amount).toBe(1000.49);
      expect(boxes?.find((b) => b.id === 'BOX_4')?.amount).toBe(200.51);
      expect(boxes?.find((b) => b.id === 'BOX_5')?.amount).toBe(799.98);
    });

    it('should generate Singapore IRAS GST Form 5 boxes', () => {
      const boxes = buildStatutoryReportBoxes('sg_gst', mockSummary);
      expect(boxes).toBeDefined();
      expect(boxes?.find((b) => b.id === 'BOX_6')?.amount).toBe(1000);
      expect(boxes?.find((b) => b.id === 'BOX_7')?.amount).toBe(201);
      expect(boxes?.find((b) => b.id === 'BOX_8')?.amount).toBe(799);
    });

    it('should return undefined for generic report type', () => {
      const boxes = buildStatutoryReportBoxes('generic', mockSummary);
      expect(boxes).toBeUndefined();
    });
  });

  describe('getTaxReportMetadata', () => {
    it('should return title and subtitle for each jurisdiction', () => {
      expect(getTaxReportMetadata('generic').title).toBe('Generic Tax Summary');
      expect(getTaxReportMetadata('au_bas').title).toBe('ATO BAS Report');
      expect(getTaxReportMetadata('uk_vat').title).toBe('HMRC VAT Return');
      expect(getTaxReportMetadata('sg_gst').title).toBe('IRAS GST Return');
    });
  });
});
