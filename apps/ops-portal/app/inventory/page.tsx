'use client';

import Shell from '@/components/Shell';
import ProductStockView from './components/ProductStockView';

export default function InventoryPage() {
  return (
    <Shell>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <ProductStockView />
      </div>
    </Shell>
  );
}
