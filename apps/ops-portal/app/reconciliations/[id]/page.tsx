import React from 'react';
import EditReconciliationClient from './EditReconciliationClient';

export const metadata = {
  title: 'Reconciliation',
};

export default function ReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  return <EditReconciliationClient id={id} />;
}
