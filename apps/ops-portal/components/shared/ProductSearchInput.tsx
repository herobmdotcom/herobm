'use client';

import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import AsyncSelect from './AsyncSelect';

export interface Product {
  productId: string;
  productNumber: string;
  name: string;
  listPrice: string;
  tradePrice: string;
  standardCost?: string | null;
  baseUom?: string | null;
  structureType?: 'standard' | 'kit';
  productType?: string;
  productUoms?: unknown[];
  productGroupId?: string | null;
  salesTaxCategoryId?: string | null;
}

interface ProductSearchInputProps {
  onSelect: (product: Product) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  fulfillmentLocationId?: string;
  structureType?: 'standard' | 'kit';
  disabled?: boolean;
}

export default function ProductSearchInput({
  onSelect,
  placeholder,
  className,
  style,
  fulfillmentLocationId,
  structureType,
  disabled,
}: ProductSearchInputProps) {
  const t = useTranslations('common.productSearch');

  return (
    <AsyncSelect<Product>
      placeholder={placeholder || t('placeholder')}
      disabled={disabled}
      className={className}
      style={style}
      clearOnSelect
      onSearch={async (term) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const res = await api.productsControllerFindAll({ q: term, limit: 20 } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type structure bypass
        const list: Product[] = ((res.data as any)?.data || res.data || []);
        if (structureType) {
          return list.filter((p) => p.structureType === structureType);
        }
        return list;
      }}
      onChange={async (p) => {
        if (!p) return;
        try {
          const res = await api.productsControllerFindOne(p.productId);
          const data = res.data;
          if (data) {
            onSelect(data as unknown as Product);
          } else {
            onSelect(p);
          }
        } catch {
          // fallback to selected summary product if detail fetch fails
          onSelect(p);
        }
      }}
      getKey={(p) => p.productId}
      renderOption={(p) => (
        <div className="flex flex-col gap-1.5 pt-1 pb-0.5">
          <div className="min-w-0">
            <span className="text-[var(--accent)] font-semibold">
              {p.productNumber}
            </span>
            <span className="text-[var(--text-secondary)] ml-2 text-[13px]">
              {p.name}
            </span>
          </div>
        </div>
      )}
      noResultsText={t('noMatchingProducts')}
      typeMinCharsText={t('typeMinChars')}
    />
  );
}
