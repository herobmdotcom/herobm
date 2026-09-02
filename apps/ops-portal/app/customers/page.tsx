import { Metadata } from 'next';
import CustomersContent from './CustomersContent';

export const metadata: Metadata = {
  title: 'Customers',
};

export default function AccountsPage() {
  return <CustomersContent />;
}
