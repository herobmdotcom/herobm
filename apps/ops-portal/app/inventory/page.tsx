'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ProductStockView from './components/ProductStockView';
import BinContentsView from './components/BinContentsView';
import MovementsView from './components/MovementsView';
import TopographyView from './components/TopographyView';

type InventoryTab = 'products' | 'binContents' | 'movements' | 'locations';

export default function InventoryPage() {
  const tInventory = useTranslations('inventory');
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');

  const tabs: { key: InventoryTab; label: string; icon: string }[] = [
    { key: 'products', label: tInventory('tabs.products'), icon: 'inventory_2' },
    { key: 'binContents', label: tInventory('tabs.binContents'), icon: 'deployed_code' },
    { key: 'movements', label: tInventory('tabs.movements'), icon: 'swap_vert' },
    { key: 'locations', label: tInventory('tabs.locations'), icon: 'warehouse' },
  ];

  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        {/* Tab Bar */}
        <div
          className="flex items-center gap-1 mb-4 px-1 py-1 rounded-xl"
          style={{ background: '#f2f4f6' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                fontFamily: 'Manrope, sans-serif',
                background: activeTab === tab.key ? '#fff' : 'transparent',
                color: activeTab === tab.key ? '#041627' : 'var(--text-muted)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 18,
                  color: activeTab === tab.key ? 'var(--accent)' : 'inherit',
                }}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'products' && <ProductStockView />}
        {activeTab === 'binContents' && <BinContentsView />}
        {activeTab === 'movements' && <MovementsView />}
        {activeTab === 'locations' && <TopographyView />}
      </div>
    </>
  );
}
