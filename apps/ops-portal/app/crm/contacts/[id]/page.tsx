import { Metadata } from 'next';
import EditContactClient from './EditContactClient';

export const metadata: Metadata = {
  title: 'Edit Contact - CRM',
};

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditContactClient contactId={id} />;
}
