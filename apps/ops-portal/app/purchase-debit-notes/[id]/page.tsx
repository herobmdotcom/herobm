import React from 'react';
import DebitNoteDetailContent from './DebitNoteDetailContent';

export const metadata = {
  title: 'Debit Note Details | HeroBM',
};

export default async function DebitNoteDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <DebitNoteDetailContent id={params.id} />;
}
