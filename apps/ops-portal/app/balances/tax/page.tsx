import TaxBalancesContent from './TaxBalancesContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tax BAS Report | HeroBM',
  description: 'Australian ATO BAS Reporting Summary',
};

export default function TaxBalancesPage() {
  return <TaxBalancesContent />;
}
