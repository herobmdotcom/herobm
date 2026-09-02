import { Metadata } from 'next';
import ProductsContent from './ProductsContent';

export const metadata: Metadata = {
  title: 'Products',
};

export default function ProductsPage() {
  return <ProductsContent />;
}

