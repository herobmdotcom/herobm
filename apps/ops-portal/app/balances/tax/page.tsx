import TaxBalancesContent from './TaxBalancesContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tax Balances & Statutory Reports',
  description: 'Tax liability balances and international statutory reporting summaries',
};

export default function TaxBalancesPage() {
  return <TaxBalancesContent />;
}
