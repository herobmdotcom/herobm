import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Metadata } from 'next';

const MapContent = dynamic(() => import('./MapContent'), {
  loading: () => <div className="p-4 text-sm text-[var(--text-muted)]">Loading map...</div>,
});

export const metadata: Metadata = {
  title: 'Map',
};

export default function MapPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading map...</div>}>
      <MapContent />
    </Suspense>
  );
}
