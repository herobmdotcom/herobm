import MapContent from './MapContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Map',
};

export default function MapPage() {
  return <MapContent />;
}
