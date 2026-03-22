'use client';

import Shell from '@/components/Shell';
import MovementsView from '../components/MovementsView';

export default function MovementsPage() {
  return (
    <Shell>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <MovementsView />
      </div>
    </Shell>
  );
}
