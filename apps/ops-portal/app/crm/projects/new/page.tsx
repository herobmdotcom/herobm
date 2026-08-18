import { Metadata } from 'next';
import ProjectForm from './ProjectForm';

export const metadata: Metadata = {
  title: 'New Project',
};

export default function NewProjectPage() {
  return <ProjectForm isNew />;
}
