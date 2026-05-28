'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div
        className="max-w-md p-8 rounded-2xl text-center bg-[var(--bg-card)] border border-[var(--border)] shadow-xl"
      >
        <h1 className="text-6xl font-extrabold mb-4 text-[var(--accent)] tracking-tight">404</h1>
        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Page Not Found</h2>
        <p className="text-sm mb-6 text-[var(--text-muted)]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary inline-block">
          Go back home
        </Link>
      </div>
    </div>
  );
}
