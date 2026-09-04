import OpportunitiesContent from './OpportunitiesContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opportunities',
};

export default function OpportunitiesPage() {
  return <OpportunitiesContent />;
}
