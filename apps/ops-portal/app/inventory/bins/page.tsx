'use client';

import BinContentsView from '../components/BinContentsView';

export default function BinsPage() {
  return (
    <>
      <div className="h-full flex flex-col relative p-4 lg:p-6">
        <BinContentsView />
      </div>
    </>
  );
}
