import { Metadata } from 'next';
import SuppliersContent from './SuppliersContent';

export const metadata: Metadata = {
  title: 'Suppliers',
};

export default function SuppliersPage() {
  return <SuppliersContent />;
}
