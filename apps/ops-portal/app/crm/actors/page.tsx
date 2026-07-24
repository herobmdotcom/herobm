import ActorsContent from './ActorsContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Actors - CRM',
};

export default function ActorsPage() {
  return <ActorsContent />;
}
