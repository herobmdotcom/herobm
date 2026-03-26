'use client';

import ProductStockView from './components/ProductStockView';

export default function InventoryPage() {
  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <ProductStockView />
      </div>
    </>
  );
}
