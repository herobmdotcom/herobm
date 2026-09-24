import { Metadata } from 'next';
import ProjectNewClient from './ProjectNewClient';

export const metadata: Metadata = {
  title: 'Create Project',
};

export default function NewProjectPage() {
  return <ProjectNewClient />;
}
