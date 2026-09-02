import { Metadata } from 'next';
import PurchaseOrdersContent from './PurchaseOrdersContent';

export const metadata: Metadata = {
  title: 'Purchase Orders',
};

export default function PurchaseOrdersPage() {
  return <PurchaseOrdersContent />;
}

