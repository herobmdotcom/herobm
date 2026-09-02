import { Metadata } from 'next';
import SalesQuotesContent from './SalesQuotesContent';

export const metadata: Metadata = {
  title: 'Sales Quotes',
};

export default function QuotesPage() {
  return <SalesQuotesContent />;
}
