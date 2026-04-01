import { Metadata } from 'next';
import GeneralLedgerContent from './GeneralLedgerContent';

export const metadata: Metadata = {
  title: 'General Ledger',
};

export default function GeneralLedgerPage() {
  return <GeneralLedgerContent />;
}

