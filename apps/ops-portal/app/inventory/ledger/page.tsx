'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import InventoryLedgerContent from './InventoryLedgerContent';

export default function LedgerPage() {
  useDocumentTitle('Inventory Ledger');
  return <InventoryLedgerContent />;
}
