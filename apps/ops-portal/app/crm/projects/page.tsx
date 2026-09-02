import ProjectsContent from './ProjectsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects',
};

export default function ProjectsPage() {
  return <ProjectsContent />;
}
