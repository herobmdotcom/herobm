import { Metadata } from 'next';
import FiscalPeriodsContent from './FiscalPeriodsContent';

export const metadata: Metadata = {
  title: 'Fiscal Periods',
};

export default function FiscalPeriodsPage() {
  return <FiscalPeriodsContent />;
}
