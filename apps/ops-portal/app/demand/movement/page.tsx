import { Metadata } from 'next';
import MovementContent from './MovementContent';

export const metadata: Metadata = {
  title: 'Stock Movement Report',
};

export default function MovementPage() {
  return <MovementContent />;
}
