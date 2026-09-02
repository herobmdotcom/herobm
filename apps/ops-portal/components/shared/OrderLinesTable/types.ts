import type { ProductUom, InventoryGap } from '@herobm/shared';

export interface TaxCategory {
  taxCategoryId: string;
  code?: string;
  title?: string;
  type?: string;
  rate?: string | number;
  isDefault?: boolean;
}

export interface UomOption {
  uomCode: string;
  ratio?: string | number;
  [key: string]: unknown;
}

export interface OrderLineItem {
  id?: string;
  key?: string | number;
  salesOrderLineId?: string;
  purchaseOrderLineId?: string;
  lineNumber?: number | string;
  lineType?: string | null;
  productId?: string | null;
  productNumber?: string;
  productDescription?: string;
  quantity?: string | number;
  quantityReceived?: string | number;
  unitOfMeasure?: string;
  pricePerUnit?: string | number;
  unitCost?: string | number | null;
  discountPercentage?: string | number;
  taxCategoryId?: string | null;
  taxRate?: number;
  amount?: string | number;
  tax?: string | number;
  baseUom?: string | null;
  productUoms?: UomOption[] | ProductUom[] | null;
  productGroupId?: string | null;
  salesTaxCategoryId?: string | null;
  isPostConfirmation?: boolean | null;
  onHand?: number;
  hasGap?: boolean;
  gapMessage?: string;
  isBackordered?: boolean;
  warningTitle?: string;
}

export interface OrderLinesTableProps<T extends OrderLineItem = OrderLineItem> {
  lines: T[];
  currencyCode?: string;
  taxCategories: TaxCategory[];
  isEditable?: boolean;
  isSaving?: boolean;
  isDetailsEditable?: boolean;
  isPostConfirmationAddingEnabled?: boolean;
  mode?: 'sales' | 'purchase' | 'counter';
  showUnitCost?: boolean;
  showReceived?: boolean;
  allowCatalogDescriptionEdit?: boolean;
  externalTaxProvider?: string | null;
  isTaxStale?: boolean;
  subtotal?: number;
  totalTax?: number;
  totalDiscount?: number;
  grandTotal?: number;
  gapMap?: Record<string, InventoryGap>;
  activeBackorders?: Set<string>;
  isPreConfirmation?: boolean;
  customEmptyMessage?: string;
  onUpdateLine?: (indexOrId: string | number, field: string, value: unknown) => void | Promise<void>;
  onUpdateLineFields?: (indexOrId: string | number, fields: Record<string, unknown>) => void | Promise<void>;
  onRemoveLine?: (indexOrId: string | number) => void | Promise<void>;
  onCalculateTaxes?: () => void | Promise<void>;
}
