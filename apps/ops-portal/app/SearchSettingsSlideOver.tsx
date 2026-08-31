'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

export const DEFAULT_SEARCH_ENTITIES: string[] = [
  'product',
  'customer',
  'sales_order',
  'supplier',
  'purchase_order',
  'sales_invoice',
  'purchase_invoice',
  'work_order',
];

export const ALL_SEARCH_ENTITIES: string[] = [
  'product',
  'customer',
  'sales_order',
  'supplier',
  'purchase_order',
  'shipment',
  'goods_receipt',
  'sales_invoice',
  'purchase_invoice',
  'sales_return',
  'purchase_return',
  'sales_credit_note',
  'purchase_debit_note',
  'transfer_order',
  'work_order',
  'contact',
  'project',
  'payment',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enabledEntities: string[];
  onChange: (entities: string[]) => void;
}

export default function SearchSettingsSlideOver({
  isOpen,
  onClose,
  enabledEntities,
  onChange,
}: Props) {
  const t = useTranslations('dashboard.search');
  const tSidebar = useTranslations('sidebar.groups');

  const toggleEntity = (entity: string) => {
    if (enabledEntities.includes(entity)) {
      onChange(enabledEntities.filter((e) => e !== entity));
    } else {
      onChange([...enabledEntities, entity]);
    }
  };

  const handleSelectAll = () => {
    onChange([...ALL_SEARCH_ENTITIES]);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleResetDefaults = () => {
    onChange([...DEFAULT_SEARCH_ENTITIES]);
  };

  const OptionRow = ({ entity }: { entity: string }) => {
    const isChecked = enabledEntities.includes(entity);
    return (
      <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-[var(--border)]">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggleEntity(entity)}
          className="w-4 h-4 rounded text-accent focus:ring-accent"
        />
        <span className="text-[14px] text-[var(--text-primary)]">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl translation lookup for dynamic entity key */}
          {t(`types.${entity}` as any)}
        </span>
      </label>
    );
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={t('settings')}>
      <div className="flex flex-col gap-6">
        <p className="text-[13px] opacity-70 text-[var(--text-primary)]">
          {t('settingsDesc')}
        </p>

        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[var(--border)]">
          <Button variant="secondary" size="sm" onClick={handleSelectAll}>
            {t('selectAll')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDeselectAll}>
            {t('deselectAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
            {t('resetToDefault')}
          </Button>
        </div>

        {/* Sales Group */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('sales')}
          </div>
          <OptionRow entity="customer" />
          <OptionRow entity="sales_order" />
          <OptionRow entity="sales_invoice" />
          <OptionRow entity="sales_return" />
          <OptionRow entity="sales_credit_note" />
          <OptionRow entity="shipment" />
        </div>

        {/* Purchasing Group */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('purchasing')}
          </div>
          <OptionRow entity="supplier" />
          <OptionRow entity="purchase_order" />
          <OptionRow entity="purchase_invoice" />
          <OptionRow entity="purchase_return" />
          <OptionRow entity="purchase_debit_note" />
          <OptionRow entity="goods_receipt" />
        </div>

        {/* Inventory & Manufacturing Group */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('inventory')}
          </div>
          <OptionRow entity="product" />
          <OptionRow entity="transfer_order" />
          <OptionRow entity="work_order" />
        </div>

        {/* CRM & Finance Group */}
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-50 text-[var(--text-primary)]">
            {tSidebar('finance')}
          </div>
          <OptionRow entity="contact" />
          <OptionRow entity="project" />
          <OptionRow entity="payment" />
        </div>
      </div>
    </SlideOver>
  );
}
