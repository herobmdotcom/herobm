import { Metadata } from 'next';
import EditProjectClient from './EditProjectClient';

export const metadata: Metadata = {
  title: 'Project',
};

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProjectClient projectId={id} />;
}
