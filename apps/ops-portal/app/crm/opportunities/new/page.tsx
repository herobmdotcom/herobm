import OpportunityForm from './OpportunityForm';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Opportunity',
};

export default function NewOpportunityPage() {
  return <OpportunityForm />;
}
