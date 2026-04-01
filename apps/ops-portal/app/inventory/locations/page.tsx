'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import InventoryLocationsContent from './InventoryLocationsContent';

export default function LocationsPage() {
  useDocumentTitle('Inventory Locations');
  return <InventoryLocationsContent />;
}
