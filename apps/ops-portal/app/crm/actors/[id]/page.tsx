import { Metadata } from 'next';
import EditActorClient from './EditActorClient';

export const metadata: Metadata = {
  title: 'Actor',
};

export default async function EditActorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditActorClient actorId={id} />;
}
