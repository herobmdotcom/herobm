'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import InventoryMovementsContent from './InventoryMovementsContent';

export default function MovementsPage() {
  useDocumentTitle('Inventory Movements');
  return <InventoryMovementsContent />;
}
