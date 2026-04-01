import { Metadata } from 'next';
import AccountsContent from './AccountsContent';

export const metadata: Metadata = {
  title: 'Accounts',
};

export default function AccountsPage() {
  return <AccountsContent />;
}
