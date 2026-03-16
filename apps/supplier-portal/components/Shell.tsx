'use client';

import { Shell as SharedShell } from '@modbm/portal-ui';
import Sidebar from '@/components/Sidebar';

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SharedShell sidebar={<Sidebar />}>
      {children}
    </SharedShell>
  );
}
