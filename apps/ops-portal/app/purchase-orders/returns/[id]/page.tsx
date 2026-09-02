import React from 'react';
import EditPurchaseReturnClient from './EditPurchaseReturnClient';

export default function PurchaseReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <EditPurchaseReturnClient id={id} />;
}
