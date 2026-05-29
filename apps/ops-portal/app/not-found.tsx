'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-4">
      <div className="w-full max-w-md p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-md text-center">
        <h1 className="text-5xl font-extrabold mb-3 text-[var(--accent)] tracking-tight">404</h1>
        <h2 className="text-lg font-bold mb-2 text-[var(--text-primary)]">Page Not Found</h2>
        <p className="text-sm mb-6 text-[var(--text-muted)]">
          The page you are looking for does not exist or has been moved.
        </p>
        
        <Link href="/" className="btn btn-primary inline-flex justify-center w-full mb-2">
          Go back home
        </Link>
      </div>
    </div>
  );
}
