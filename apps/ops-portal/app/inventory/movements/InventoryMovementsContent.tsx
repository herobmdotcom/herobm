'use client';

import MovementsView from '../components/MovementsView';

export default function InventoryMovementsContent() {
  return (
    <div className="h-full flex flex-col relative p-4 lg:p-6">
      <MovementsView />
    </div>
  );
}
