/* eslint-disable no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */
'use client';

import React from 'react';
import { useLicense } from './LicenseProvider';
import Link from 'next/link';

export default function LicenseBanner() {
  const { status, isLoading } = useLicense();

  if (isLoading || !status || status.state === 'active') {
    return null;
  }

  const isReadOnly = status.state === 'read_only';

  return (
    <div className={`w-full text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-4 ${isReadOnly ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'}`}>
      <span className="material-symbols-outlined text-[20px]">
        {isReadOnly ? 'error' : 'warning'}
      </span>
      <span>{status.warningMessage}</span>
      <Link href="/admin/settings/license" className="underline font-bold ml-4">
        Manage License
      </Link>
    </div>
  );
}
