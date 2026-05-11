import { Metadata } from 'next';
import TransfersContent from './TransfersContent';

export const metadata: Metadata = {
  title: 'Transfer Orders',
};

export default function TransfersPage() {
  return <TransfersContent />;
}
