import { Metadata } from 'next';
import RestockContent from './RestockContent';

export const metadata: Metadata = {
  title: 'Restock',
};

export default function RestockPage() {
  return <RestockContent />;
}
