import { Metadata } from 'next';
import ScanToDispatchClient from './ScanToDispatchClient';

export const metadata: Metadata = {
  title: 'Scan to Dispatch',
};

export default function ScanToDispatchPage() {
  return <ScanToDispatchClient />;
}
