'use client';

import LedgerView from '../components/LedgerView';

export default function LedgerPage() {
  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <LedgerView />
      </div>
    </>
  );
}
