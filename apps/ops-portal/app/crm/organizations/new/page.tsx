import { Metadata } from 'next';
import OrganizationForm from './OrganizationForm';

export const metadata: Metadata = {
  title: 'New Organization',
};

export default function NewOrganizationPage() {
  return <OrganizationForm isNew />;
}
