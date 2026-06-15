import {
  resolveSupplierRiskProfile,
  SupplierProfile,
  SupplierGroupProfile,
  SupplierExpiry,
} from './supplier-risk.domain';
import { SUPPLIER_STATE } from '@herobm/shared';

describe('resolving Supplier Risk Profile', () => {
  it('should use default values if everything is empty', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const result = resolveSupplierRiskProfile(supplier);

    expect(result.tradingTermsId).toBeNull();
    expect(result.earlyPaymentDiscount).toBe('0');
    expect(result.creditLimit).toBe('0');
    expect(result.isPurchasingBlocked).toBe(false);
    expect(result.purchasingBlockReasons).toHaveLength(0);
    expect(result.isPaymentBlocked).toBe(false);
    expect(result.paymentBlockReasons).toHaveLength(0);
  });

  it('should prioritize supplier fields over group fields if they are set', () => {
    const supplier: SupplierProfile = {
      tradingTermsId: 'term-sub',
      earlyPaymentDiscount: '2.5',
      creditLimit: '1000',
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const group: SupplierGroupProfile = {
      tradingTermsId: 'term-main',
      earlyPaymentDiscount: '0.0',
      creditLimit: '500',
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const result = resolveSupplierRiskProfile(supplier, group);

    expect(result.tradingTermsId).toBe('term-sub');
    expect(result.earlyPaymentDiscount).toBe('2.5');
    expect(result.creditLimit).toBe('1000');
  });

  it('should inherit group fields if supplier fields are undefined or null', () => {
    const supplier: SupplierProfile = {
      tradingTermsId: null,
      earlyPaymentDiscount: null,
      creditLimit: null,
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const group: SupplierGroupProfile = {
      tradingTermsId: 'term-main',
      earlyPaymentDiscount: '1.5',
      creditLimit: '2000',
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const result = resolveSupplierRiskProfile(supplier, group);

    expect(result.tradingTermsId).toBe('term-main');
    expect(result.earlyPaymentDiscount).toBe('1.5');
    expect(result.creditLimit).toBe('2000');
  });

  it('should block purchasing if the group is blocked, even if supplier is not', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const group: SupplierGroupProfile = {
      isPurchasingBlocked: true,
      purchasingBlockReason: 'quality_issues',
      isPaymentBlocked: false,
    };

    const result = resolveSupplierRiskProfile(supplier, group);

    expect(result.isPurchasingBlocked).toBe(true);
    expect(result.purchasingBlockReasons).toContain('quality_issues');
  });

  it('should aggregate block reasons from both group and supplier', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: true,
      purchasingBlockReason: 'dispute',
      isPaymentBlocked: true,
      paymentBlockReason: 'invoice_dispute',
    };

    const group: SupplierGroupProfile = {
      isPurchasingBlocked: true,
      purchasingBlockReason: 'quality_issues',
      isPaymentBlocked: true,
      paymentBlockReason: 'contractual_breach',
    };

    const result = resolveSupplierRiskProfile(supplier, group);

    expect(result.isPurchasingBlocked).toBe(true);
    expect(result.purchasingBlockReasons).toContain('quality_issues');
    expect(result.purchasingBlockReasons).toContain('dispute');
    expect(result.purchasingBlockReasons.length).toBe(2);

    expect(result.isPaymentBlocked).toBe(true);
    expect(result.paymentBlockReasons).toContain('contractual_breach');
    expect(result.paymentBlockReasons).toContain('invoice_dispute');
    expect(result.paymentBlockReasons.length).toBe(2);
  });

  it('should block purchasing if an expiry date is in the past', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const expiries: SupplierExpiry[] = [
      { expiryType: 'insurance', expiryDate: pastDate },
    ];

    const result = resolveSupplierRiskProfile(supplier, null, expiries);

    expect(result.isPurchasingBlocked).toBe(true);
    expect(result.purchasingBlockReasons).toContain('compliance_breach');
  });

  it('should NOT block purchasing if an expiry date is in the future', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5); // IN 5 days

    const expiries: SupplierExpiry[] = [
      { expiryType: 'insurance', expiryDate: futureDate },
    ];

    const result = resolveSupplierRiskProfile(supplier, null, expiries);

    expect(result.isPurchasingBlocked).toBe(false);
    expect(result.purchasingBlockReasons).toHaveLength(0);
  });

  it('should deduplicate multiple compliance breach reasons', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: true,
      purchasingBlockReason: 'compliance_breach',
      isPaymentBlocked: false,
    };

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const expiries: SupplierExpiry[] = [
      { expiryType: 'insurance', expiryDate: pastDate },
      { expiryType: 'tax_certificate', expiryDate: pastDate },
    ];

    const result = resolveSupplierRiskProfile(supplier, null, expiries);

    expect(result.isPurchasingBlocked).toBe(true);
    expect(result.purchasingBlockReasons).toContain('compliance_breach');
    expect(result.purchasingBlockReasons.length).toBe(1); // deduplication check
  });

  it('should block both purchasing and payment if the supplier is inactive', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
      stateCode: SUPPLIER_STATE.INACTIVE,
    };

    const result = resolveSupplierRiskProfile(supplier);

    expect(result.isPurchasingBlocked).toBe(true);
    expect(result.purchasingBlockReasons).toContain('supplier_inactive');
    expect(result.isPaymentBlocked).toBe(true);
    expect(result.paymentBlockReasons).toContain('supplier_inactive');
  });

  it('should NOT block based on stateCode if supplier is active', () => {
    const supplier: SupplierProfile = {
      isPurchasingBlocked: false,
      isPaymentBlocked: false,
      stateCode: SUPPLIER_STATE.ACTIVE,
    };

    const result = resolveSupplierRiskProfile(supplier);

    expect(result.isPurchasingBlocked).toBe(false);
    expect(result.isPaymentBlocked).toBe(false);
  });
});
