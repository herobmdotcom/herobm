'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import SlideOver from './SlideOver';
import { InlineSettingsTable, InlineTableColumn } from './InlineSettingsTable';

interface ProductGroup {
  productGroupId: string;
  groupCode: string;
  name: string;
}

interface DiscountRule {
  discountMatrixId: string;
  customerGroupId: string | null;
  customerId: string | null;
  productGroupId: string | null;
  discountPercentage: string;
}

interface DiscountMatrixSlideOverProps {
  open: boolean;
  onClose: () => void;
  ownerLabel: string;
  customerGroupId?: string;
  customerId?: string;
}

export default function DiscountMatrixSlideOver({
  open,
  onClose,
  ownerLabel,
  customerGroupId,
  customerId,
}: DiscountMatrixSlideOverProps) {
  const t = useTranslations('admin.discountMatrix');
  const tCommon = useTranslations('common');

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // New rule form
  const [newProductGroupId, setNewProductGroupId] = useState('');
  const [newDiscount, setNewDiscount] = useState('');

  const ownerId = customerGroupId || customerId || '';
  const ownerParam = customerGroupId
    ? `customerGroupId=${customerGroupId}`
    : `customerId=${customerId}`;

  const loadData = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [rulesRes, pgRes] = await Promise.all([
        api.discountMatrixControllerList({
          ...(customerGroupId ? { customerGroupId } : {}),
          ...(customerId ? { customerId } : {}),
        }),
        api.productGroupsControllerFindAll(),
      ]);
      setRules(rulesRes.data);
      setProductGroups(pgRes.data as unknown as ProductGroup[]);
    } catch (err: unknown) {
      toast.error('Failed to load discount rules: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerParam]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // The wildcard rule (product_group = null)
  const wildcardRule = rules.find((r) => r.productGroupId === null);
  // Product-group-specific rules
  const specificRules = rules.filter((r) => r.productGroupId !== null);

  // Product groups that don't yet have a rule
  const availableProductGroups = productGroups.filter(
    (pg) => !specificRules.some((r) => r.productGroupId === pg.productGroupId),
  );

  const handleSaveWildcard = async (value: string) => {
    try {
      if (wildcardRule) {
        await api.discountMatrixControllerUpdate(wildcardRule.discountMatrixId, {
          discountPercentage: value,
        });
      } else {
        await api.discountMatrixControllerCreate({
          ...(customerGroupId ? { customerGroupId } : {}),
          ...(customerId ? { customerId } : {}),
          discountPercentage: value,
        } as Parameters<typeof api.discountMatrixControllerCreate>[0]);
      }
      toast.success(t('toasts.saved'));
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveSpecific = async (ruleId: string, value: string) => {
    try {
      await api.discountMatrixControllerUpdate(ruleId, {
        discountPercentage: value,
      });
      toast.success(t('toasts.saved'));
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAdd = async () => {
    if (!newDiscount) return;
    try {
      await api.discountMatrixControllerCreate({
            ...(customerGroupId ? { customerGroupId } : {}),
            ...(customerId ? { customerId } : {}),
            productGroupId: newProductGroupId,
            discountPercentage: newDiscount,
          } as Parameters<typeof api.discountMatrixControllerCreate>[0]);
      toast.success(t('toasts.saved'));
      setNewProductGroupId('');
      setNewDiscount('');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await api.discountMatrixControllerDelete(ruleId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveSettingsTable = async (row: DiscountRule, isNew: boolean) => {
    try {
      if (isNew) {
        if (!row.productGroupId) throw new Error('Product group is required');
        await api.discountMatrixControllerCreate({
          ...(customerGroupId ? { customerGroupId } : {}),
          ...(customerId ? { customerId } : {}),
          productGroupId: row.productGroupId,
          discountPercentage: row.discountPercentage || '0',
        } as Parameters<typeof api.discountMatrixControllerCreate>[0]);
      } else {
        await api.discountMatrixControllerUpdate(row.discountMatrixId, {
          discountPercentage: row.discountPercentage,
        });
      }
      toast.success(t('toasts.saved'));
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const handleDeleteSettingsTable = async (row: DiscountRule) => {
    try {
      await api.discountMatrixControllerDelete(row.discountMatrixId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const specificRuleColumns: InlineTableColumn<DiscountRule>[] = [
    {
      key: 'productGroupId',
      title: t('productGroup'),
      type: 'custom',
      render: (row, isEditing, onChange) => {
        const isNew = !row.discountMatrixId;
        const currentPg = productGroups.find((p) => p.productGroupId === row.productGroupId);

        if (isEditing && isNew) {
          return (
            <select
              className="input w-full"
              value={row.productGroupId || ''}
              onChange={(e) => onChange?.(e.target.value)}
            >
              <option value="">{t('selectProductGroup')}</option>
              {availableProductGroups.map((pg) => (
                <option key={pg.productGroupId} value={pg.productGroupId}>
                  {pg.groupCode} — {pg.name}
                </option>
              ))}
            </select>
          );
        }
        return currentPg ? `${currentPg.groupCode} — ${currentPg.name}` : row.productGroupId;
      }
    },
    {
      key: 'discountPercentage',
      title: t('discountPercent'),
      type: 'custom',
      width: 120,
      render: (row, isEditing, onChange) => {
        if (isEditing) {
          return (
            <div className="relative">
              <input
                className="input w-full pr-6"
                type="number"
                step="0.01"
                value={row.discountPercentage || ''}
                onChange={(e) => onChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Let InlineSettingsTable handle save on enter via its own handlers if possible, 
                    // but since this is custom, we might just update value.
                    // InlineSettingsTable saves on enter by wrapping in a form, so propagation works.
                  }
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">%</span>
            </div>
          );
        }
        return `${row.discountPercentage || 0}%`;
      }
    }
  ];

  return (
    <SlideOver
      isOpen={open}
      onClose={onClose}
      title={t('title')}
      subtitle={ownerLabel}
    >
      <div className="flex flex-col gap-8">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tCommon('loading')}
          </p>
        ) : (
          <>
            {/* Wildcard (Base) Discount */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                {t('baseDiscount')}
              </label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <input
                    className="input pr-6"
                    style={{ width: 100 }}
                    type="number"
                    step="0.01"
                    defaultValue={wildcardRule?.discountPercentage ?? '0'}
                    onBlur={(e) => handleSaveWildcard(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleSaveWildcard((e.target as HTMLInputElement).value);
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">%</span>
                </div>
              </div>
            </div>

            {/* Product Group Rules */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
                {t('productGroupRules')}
              </label>

              <InlineSettingsTable
                columns={specificRuleColumns}
                data={specificRules}
                rowKey={(r) => r.discountMatrixId}
                onSave={handleSaveSettingsTable}
                onDelete={handleDeleteSettingsTable}
                onAdd={() => ({
                  discountMatrixId: '',
                  customerGroupId: customerGroupId || null,
                  customerId: customerId || null,
                  productGroupId: null,
                  discountPercentage: '',
                })}
                addLabel={tCommon('add')}
                emptyLabel={t('noProductGroupRules')}
              />
            </div>
          </>
        )}
      </div>
    </SlideOver>
  );
}
