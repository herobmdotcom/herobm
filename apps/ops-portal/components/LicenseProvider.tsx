/* eslint-disable no-restricted-syntax */
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { licenseControllerGetStatus } from '@herobm/sdk';

export type LicenseState = 'active' | 'warning' | 'read_only';

export interface LicenseStatus {
  state: LicenseState;
  type: 'trial' | 'perpetual' | 'none';
  expiresAt: string | null; // serialized date
  warningMessage: string | null;
  systemId: string | null;
  licenseHash: string | null;
}

interface LicenseContextType {
  status: LicenseStatus | null;
  isLoading: boolean;
  reloadStatus: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadStatus = async () => {
    setIsLoading(true);
    try {
      const res = await licenseControllerGetStatus();
      setStatus(res.data as unknown as LicenseStatus);
    } catch (err) {
      console.error('Failed to load license status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadStatus();
  }, []);

  return (
    <LicenseContext.Provider value={{ status, isLoading, reloadStatus }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
