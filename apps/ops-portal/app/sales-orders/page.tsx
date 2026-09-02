import { Metadata } from 'next';
import SalesOrdersContent from './SalesOrdersContent';

export const metadata: Metadata = {
  title: 'Sales Orders',
};

export default function OrdersPage() {
  return <SalesOrdersContent />;
}

