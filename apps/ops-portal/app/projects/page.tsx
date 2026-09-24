import { Metadata } from 'next';
import ProjectsListClient from './ProjectsListClient';

export const metadata: Metadata = {
  title: 'Projects',
};

export default function ProjectsPage() {
  return <ProjectsListClient />;
}
