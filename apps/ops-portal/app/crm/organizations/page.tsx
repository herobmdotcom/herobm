import OrganizationsContent from './OrganizationsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Organizations',
};

export default function OrganizationsPage() {
  return <OrganizationsContent />;
}
