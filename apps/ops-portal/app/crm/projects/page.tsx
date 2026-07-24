import ProjectsContent from './ProjectsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects - CRM',
};

export default function ProjectsPage() {
  return <ProjectsContent />;
}
