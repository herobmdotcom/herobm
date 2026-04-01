'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import InventoryBinsContent from './InventoryBinsContent';

export default function BinsPage() {
  useDocumentTitle('Inventory Bins');
  return <InventoryBinsContent />;
}
