import type { ValidState } from '@/types/states';

export interface SupplierProfile {
  tradingTermsId?: string | null;
  earlyPaymentDiscount?: string | null;
  creditLimit?: string | null;
  isPurchasingBlocked?: boolean;
  purchasingBlockReason?: string | null;
  isPaymentBlocked?: boolean;
  paymentBlockReason?: string | null;
}

export interface SupplierGroupProfile {
  tradingTermsId?: string | null;
  earlyPaymentDiscount?: string | null;
  creditLimit?: string | null;
  isPurchasingBlocked?: boolean;
  purchasingBlockReason?: string | null;
  isPaymentBlocked?: boolean;
  paymentBlockReason?: string | null;
}

export interface SupplierExpiry {
  expiryId?: string;
  expiryType: string;
  expiryDate: string | Date; // ISO string or Date object
}

export interface ResolvedRiskProfile {
  tradingTermsId: string | null;
  earlyPaymentDiscount: string;
  creditLimit: string;
  isPurchasingBlocked: boolean;
  purchasingBlockReasons: string[];
  isPaymentBlocked: boolean;
  paymentBlockReasons: string[];
}

export function resolveSupplierRiskProfile(
  supplier: SupplierProfile | null,
  group?: SupplierGroupProfile | null,
  expiries: SupplierExpiry[] = [],
): ResolvedRiskProfile {
  const resolved: ResolvedRiskProfile = {
    tradingTermsId: null,
    earlyPaymentDiscount: '0',
    creditLimit: '0',
    isPurchasingBlocked: false,
    purchasingBlockReasons: [],
    isPaymentBlocked: false,
    paymentBlockReasons: [],
  };

  if (!supplier) return resolved;

  // 1. Resolve Data Overrides (Supplier wins if NOT NULL, else Group)
  resolved.tradingTermsId = supplier.tradingTermsId || (group ? group.tradingTermsId : null) || null;
  resolved.earlyPaymentDiscount = supplier.earlyPaymentDiscount ?? (group ? group.earlyPaymentDiscount : '0') ?? '0';
  resolved.creditLimit = supplier.creditLimit ?? (group ? group.creditLimit : '0') ?? '0';

  // 2. Resolve Purchasing Blocks (Any block wins)
  if (group?.isPurchasingBlocked) {
    resolved.isPurchasingBlocked = true;
    if (group.purchasingBlockReason) resolved.purchasingBlockReasons.push(group.purchasingBlockReason);
  }

  if (supplier.isPurchasingBlocked) {
    resolved.isPurchasingBlocked = true;
    if (supplier.purchasingBlockReason) resolved.purchasingBlockReasons.push(supplier.purchasingBlockReason);
  }

  // 3. Resolve Payment Blocks (Any block wins)
  if (group?.isPaymentBlocked) {
    resolved.isPaymentBlocked = true;
    if (group.paymentBlockReason) resolved.paymentBlockReasons.push(group.paymentBlockReason);
  }

  if (supplier.isPaymentBlocked) {
    resolved.isPaymentBlocked = true;
    if (supplier.paymentBlockReason) resolved.paymentBlockReasons.push(supplier.paymentBlockReason);
  }

  // 4. Resolve Expiries
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const expiry of expiries) {
    // Treat invalid or missing dates as fine for risk resolution, or skip them
    if (!expiry.expiryDate) continue;
    const expiryDate = new Date(expiry.expiryDate);
    if (!isNaN(expiryDate.getTime()) && expiryDate < today) {
      resolved.isPurchasingBlocked = true;
      resolved.purchasingBlockReasons.push('compliance_breach');
    }
  }

  // Deduplicate reasons
  resolved.purchasingBlockReasons = Array.from(new Set(resolved.purchasingBlockReasons));
  resolved.paymentBlockReasons = Array.from(new Set(resolved.paymentBlockReasons));

  return resolved;
}
