import { Metadata } from 'next';
import ResourceDetailClient from './ResourceDetailClient';

export const metadata: Metadata = {
  title: 'Resource Details',
};

export default async function ResourceDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return <ResourceDetailClient resourceId={params.id} />;
}
