import { Metadata } from 'next';
import StocktakesContent from './StocktakesContent';

export const metadata: Metadata = {
  title: 'Stocktakes',
};

export default function StocktakesPage() {
  return <StocktakesContent />;
}
