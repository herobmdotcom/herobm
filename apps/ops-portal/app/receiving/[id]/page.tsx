import React from 'react';
import ReceptionDetailContent from './ReceptionDetailContent';

export const metadata = {
  title: 'Goods Receipt Details',
};

export default async function ReceptionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ReceptionDetailContent id={params.id} />;
}
