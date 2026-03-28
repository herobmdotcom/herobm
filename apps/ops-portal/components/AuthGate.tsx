'use client';

import { default as SharedAuthGate } from '@/components/shared/AuthGate';

export { useAuth } from '@/components/shared/AuthGate';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <SharedAuthGate portalName="herobm" idPrefix="portal">
      {children}
    </SharedAuthGate>
  );
}
