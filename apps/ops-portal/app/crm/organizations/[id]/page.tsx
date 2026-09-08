import { Metadata } from 'next';
import EditOrganizationClient from './EditOrganizationClient';

export const metadata: Metadata = {
  title: 'Organization',
};

export default async function EditOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditOrganizationClient organizationId={id} />;
}
