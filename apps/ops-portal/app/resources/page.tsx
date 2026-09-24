import { Suspense } from 'react';
import { Metadata } from 'next';
import ResourcesListClient from './ResourcesListClient';

export const metadata: Metadata = {
  title: 'Resources',
};

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <ResourcesListClient />
    </Suspense>
  );
}
