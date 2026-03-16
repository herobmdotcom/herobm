'use client';

import { AuthGate as SharedAuthGate } from '@modbm/portal-ui';

export { useAuth } from '@modbm/portal-ui';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <SharedAuthGate portalName="Sales Portal" idPrefix="sales">
      {children}
    </SharedAuthGate>
  );
}
