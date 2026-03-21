'use client';

import { default as SharedAuthGate } from '@/components/shared/AuthGate';

export { useAuth } from '@/components/shared/AuthGate';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <SharedAuthGate portalName="modbm" idPrefix="portal">
      {children}
    </SharedAuthGate>
  );
}
