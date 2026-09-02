import React from 'react';
import CreditNoteDetailContent from './CreditNoteDetailContent';

export const metadata = {
  title: 'Credit Note',
};

export default async function CreditNoteDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CreditNoteDetailContent id={params.id} />;
}
