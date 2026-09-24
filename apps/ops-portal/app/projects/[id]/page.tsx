import { Metadata } from 'next';
import ProjectDetailClient from './ProjectDetailClient';

export const metadata: Metadata = {
  title: 'Project Details',
};

export default async function ProjectDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return <ProjectDetailClient projectId={params.id} />;
}
