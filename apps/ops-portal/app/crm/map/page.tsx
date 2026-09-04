import React, { Suspense } from 'react';
import MapContent from './MapContent';
import { Metadata } from 'next';

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
