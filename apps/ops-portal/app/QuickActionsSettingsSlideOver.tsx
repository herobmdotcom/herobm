'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

export interface QuickActionItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  icon: string;
  enabled: boolean;
  isCustom?: boolean;
}

export const PRESET_QUICK_ACTIONS: Omit<QuickActionItem, 'enabled'>[] = [
  {
    id: 'create_quote',
    title: 'createQuote',
    description: 'createQuoteDesc',
    href: '/sales-orders/new',
    icon: 'request_quote',
  },
  {
    id: 'create_sales_order',
    title: 'createSalesOrder',
    description: 'createSalesDesc',
    href: '/sales-orders/new',
    icon: 'receipt_long',
  },
  {
    id: 'create_customer',
    title: 'createCustomer',
    description: 'createCustomerDesc',
    href: '/customers/new',
    icon: 'storefront',
  },
  {
    id: 'sales_return',
    title: 'salesReturn',
    description: 'salesReturnDesc',
    href: '/sales-returns',
    icon: 'assignment_return',
  },
  {
    id: 'create_purchase_order',
    title: 'createPurchaseOrder',
    description: 'createPurchaseDesc',
    href: '/purchase-orders/new',
    icon: 'local_shipping',
  },
  {
    id: 'create_supplier',
    title: 'createSupplier',
    description: 'createSupplierDesc',
    href: '/suppliers/new',
    icon: 'factory',
  },
  {
    id: 'receive_goods',
    title: 'receiveGoods',
    description: 'receiveGoodsDesc',
    href: '/receiving/new',
    icon: 'move_to_inbox',
  },
  {
    id: 'create_product',
    title: 'createProduct',
    description: 'createProductDesc',
    href: '/products/new',
    icon: 'category',
  },
  {
    id: 'create_transfer',
    title: 'createTransfer',
    description: 'createTransferDesc',
    href: '/inventory/transfers',
    icon: 'sync_alt',
  },
  {
    id: 'create_work_order',
    title: 'createWorkOrder',
    description: 'createWorkOrderDesc',
    href: '/manufacturing/work-orders/new',
    icon: 'build',
  },
  {
    id: 'scan_dispatch',
    title: 'scanDispatch',
    description: 'scanDispatchDesc',
    href: '/inventory/shipping/scan-to-dispatch',
    icon: 'barcode_scanner',
  },
  {
    id: 'stock_adjustment',
    title: 'stockAdjustment',
    description: 'stockAdjustmentDesc',
    href: '/inventory/ledger',
    icon: 'tune',
  },
  {
    id: 'create_contact',
    title: 'createContact',
    description: 'createContactDesc',
    href: '/crm/contacts/new',
    icon: 'contacts',
  },
  {
    id: 'create_project',
    title: 'createProject',
    description: 'createProjectDesc',
    href: '/crm/projects/new',
    icon: 'folder',
  },
  {
    id: 'record_payment',
    title: 'recordPayment',
    description: 'recordPaymentDesc',
    href: '/payments',
    icon: 'payments',
  },
  {
    id: 'journal_entry',
    title: 'journalEntry',
    description: 'journalEntryDesc',
    href: '/general-ledger/journal-entries/new',
    icon: 'menu_book',
  },
];

export const DEFAULT_QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: 'create_quote',
    title: 'createQuote',
    description: 'createQuoteDesc',
    href: '/sales-orders/new',
    icon: 'request_quote',
    enabled: true,
  },
  {
    id: 'create_sales_order',
    title: 'createSalesOrder',
    description: 'createSalesDesc',
    href: '/sales-orders/new',
    icon: 'receipt_long',
    enabled: true,
  },
  {
    id: 'create_purchase_order',
    title: 'createPurchaseOrder',
    description: 'createPurchaseDesc',
    href: '/purchase-orders/new',
    icon: 'local_shipping',
    enabled: true,
  },
  {
    id: 'create_customer',
    title: 'createCustomer',
    description: 'createCustomerDesc',
    href: '/customers/new',
    icon: 'storefront',
    enabled: true,
  },
  {
    id: 'create_product',
    title: 'createProduct',
    description: 'createProductDesc',
    href: '/products/new',
    icon: 'category',
    enabled: true,
  },
  {
    id: 'receive_goods',
    title: 'receiveGoods',
    description: 'receiveGoodsDesc',
    href: '/receiving/new',
    icon: 'move_to_inbox',
    enabled: true,
  },
];

const COMMON_ICONS = [
  'bolt',
  'star',
  'link',
  'open_in_new',
  'payments',
  'analytics',
  'monitoring',
  'dashboard',
  'receipt',
  'inventory',
  'shopping_cart',
  'assignment',
  'badge',
  'bookmark',
  'folder',
  'build',
  'calculate',
  'hub',
  'mail',
  'language',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quickActions: QuickActionItem[];
  onChange: (actions: QuickActionItem[]) => void;
}

export default function QuickActionsSettingsSlideOver({
  isOpen,
  onClose,
  quickActions,
  onChange,
}: Props) {
  const t = useTranslations('dashboard.quickActions');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customHref, setCustomHref] = useState('');
  const [customIcon, setCustomIcon] = useState('link');
  const [validationError, setValidationError] = useState('');

  // Map of enabled preset IDs
  const enabledPresetIds = new Set(
    quickActions.filter((a) => !a.isCustom && a.enabled).map((a) => a.id),
  );

  const customActions = quickActions.filter((a) => a.isCustom);

  const togglePreset = (preset: Omit<QuickActionItem, 'enabled'>) => {
    const isCurrentlyEnabled = enabledPresetIds.has(preset.id);
    let updated: QuickActionItem[];

    const existsInState = quickActions.some((a) => a.id === preset.id);

    if (existsInState) {
      updated = quickActions.map((a) =>
        a.id === preset.id ? { ...a, enabled: !isCurrentlyEnabled } : a,
      );
    } else {
      updated = [
        ...quickActions,
        {
          ...preset,
          enabled: true,
        },
      ];
    }
    onChange(updated);
  };

  const handleAddCustomAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customHref.trim()) {
      setValidationError(t('form.validation'));
      return;
    }

    const sanitizedIcon =
      customIcon.toLowerCase().trim().replace(/[\s-]+/g, '_') || 'link';

    const newAction: QuickActionItem = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      description: customDesc.trim() || undefined,
      href: customHref.trim(),
      icon: sanitizedIcon,
      enabled: true,
      isCustom: true,
    };

    onChange([...quickActions, newAction]);
    setCustomTitle('');
    setCustomDesc('');
    setCustomHref('');
    setCustomIcon('link');
    setValidationError('');
    setIsAddingCustom(false);
  };

  const handleDeleteCustomAction = (id: string) => {
    onChange(quickActions.filter((a) => a.id !== id));
  };

  const currentPreviewIcon =
    customIcon.toLowerCase().trim().replace(/[\s-]+/g, '_') || 'help';

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={t('settings')}>
      <div className="flex flex-col gap-6">
        <p className="text-[13px] opacity-70 text-[var(--text-primary)]">
          {t('settingsDesc')}
        </p>

        {/* Standard Preset Actions */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {t('presets')}
          </div>

          <div className="grid grid-cols-1 gap-1">
            {PRESET_QUICK_ACTIONS.map((preset) => {
              const isChecked = enabledPresetIds.has(preset.id);
              return (
                <label
                  key={preset.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePreset(preset)}
                    className="w-4 h-4 rounded text-accent focus:ring-accent"
                  />
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#006b5c]/[0.08]">
                    <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                      {preset.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[var(--text-primary)] leading-tight">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic translation key */}
                      {t(preset.title as any)}
                    </div>
                    {preset.description && (
                      <div className="text-[12px] opacity-60 truncate text-[var(--text-muted)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic translation key */}
                        {t(preset.description as any)}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Custom Actions Section */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-50 text-[var(--text-primary)]">
              {t('customActions')}
            </div>
            {!isAddingCustom && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddingCustom(true)}
              >
                {t('addCustomAction')}
              </Button>
            )}
          </div>

          {isAddingCustom && (
            <form
              onSubmit={handleAddCustomAction}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col gap-3"
            >
              <div>
                <label className="block text-[12px] font-semibold mb-1 text-[var(--text-primary)]">
                  {t('form.title')} *
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={t('form.titlePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1 text-[var(--text-primary)]">
                  {t('form.desc')}
                </label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder={t('form.descPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1 text-[var(--text-primary)]">
                  {t('form.href')} *
                </label>
                <input
                  type="text"
                  value={customHref}
                  onChange={(e) => setCustomHref(e.target.value)}
                  placeholder="e.g. /balances/customers or https://analytics.example.com"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-semibold text-[var(--text-primary)]">
                    {t('form.icon')}
                  </label>
                  <span className="text-[11px] opacity-60 text-[var(--text-muted)]">
                    Any Material Symbol name
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shrink-0"
                    title="Live Icon Preview"
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {currentPreviewIcon}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    placeholder="e.g. shopping_bag, bar_chart, public"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none font-mono transition-all"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {COMMON_ICONS.map((iconName) => (
                    <Button
                      key={iconName}
                      type="button"
                      variant="ghost"
                      size="icon"
                      icon={iconName}
                      onClick={() => setCustomIcon(iconName)}
                      className={
                        customIcon === iconName
                          ? 'w-7 h-7 !border-[var(--accent)] !bg-[var(--accent)]/10 !text-[var(--accent)]'
                          : 'w-7 h-7 border-[var(--border)] text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                      }
                      title={iconName}
                    />
                  ))}
                </div>
              </div>

              {validationError && (
                <div className="text-xs text-red-500">{validationError}</div>
              )}

              <div className="flex items-center justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                >
                  {t('form.cancel')}
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  {t('form.save')}
                </Button>
              </div>
            </form>
          )}

          {customActions.length === 0 && !isAddingCustom ? (
            <div className="text-[13px] opacity-50 py-3 text-center border border-dashed rounded-lg">
              {t('noCustomActions')}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {customActions.map((action) => {
                const isExternal =
                  action.href.startsWith('http://') ||
                  action.href.startsWith('https://');
                const sanitizedIcon =
                  action.icon?.toLowerCase().trim().replace(/[\s-]+/g, '_') ||
                  'link';

                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#006b5c]/[0.08]">
                        <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                          {sanitizedIcon}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--text-primary)] truncate">
                          <span className="truncate">{action.title}</span>
                          {isExternal && (
                            <span className="material-symbols-outlined text-[12px] opacity-40 shrink-0">
                              {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
                              {'open_in_new'}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] opacity-60 truncate text-[var(--text-muted)]">
                          {action.href}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCustomAction(action.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      title={t('deleteCustomAction')}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {/* eslint-disable-next-line no-restricted-syntax -- Material UI Icon */}
                        {'delete'}
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
