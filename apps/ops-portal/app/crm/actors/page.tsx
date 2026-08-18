import ActorsContent from './ActorsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Actors',
};

export default function ActorsPage() {
  return <ActorsContent />;
}
