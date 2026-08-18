import React from 'react';
import EditSupplierInvoiceClient from './EditSupplierInvoiceClient';

export const metadata = {
  title: 'Supplier Invoice',
};

export default function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <EditSupplierInvoiceClient id={id} />;
}
