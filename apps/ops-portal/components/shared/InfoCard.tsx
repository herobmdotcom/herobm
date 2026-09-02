import React from 'react';

interface InfoCardProps {
  title: string | React.ReactNode;
  isPrimary?: boolean;
  primaryLabel?: string;
  badges?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export default function InfoCard({ title, isPrimary, primaryLabel = 'Primary', badges, headerRight, children }: InfoCardProps) {
  return (
    <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] flex flex-col gap-1">
      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        {title}
        {isPrimary && (
          <span className="ml-2 text-xs bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 px-2 py-0.5 rounded-full font-medium">
            {primaryLabel}
          </span>
        )}
        {badges}
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {children}
      </div>
    </div>
  );
}
