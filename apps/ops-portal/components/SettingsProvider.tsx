'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';

interface GlSettings {
  baseCurrency: string;
  fiscalYearStartMonth: number;
  revenueRoutingPrecedence: string;
  expenseRoutingPrecedence: string;
  supportedBatchPaymentFormats: string[];
}

interface AppSettings {
  defaultFulfillmentLocationId: string | null;
  inventoryValuationMethod: string;
  inventoryAccountingMode: string;
  creditLimitBehavior: string;
}

interface SettingsContextType {
  gl: GlSettings | null;
  app: AppSettings | null;
  loading: boolean;
  baseCurrency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  organization: any | null;
}

const SettingsContext = createContext<SettingsContextType>({
  gl: null,
  app: null,
  loading: true,
  baseCurrency: 'EUR', // Fallback, shouldn't be used if loading blocks render
  organization: null,
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [gl, setGl] = useState<GlSettings | null>(null);
  const [app, setApp] = useState<AppSettings | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [organization, setOrganization] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [glRes, orgRes] = await Promise.all([
          api.glControllerGetSettings(),
          api.organizationControllerGet()
        ]);
        setGl(glRes.data as unknown as GlSettings);
        setOrganization(orgRes.data);
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyErr = err as any;
        if (anyErr.message !== 'Not authenticated' && anyErr.status !== 401 && anyErr.status !== 403) {
          reportError(err, 'SettingsProvider');
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        gl,
        app,
        loading,
        baseCurrency: gl?.baseCurrency || 'EUR',
        organization,
      }}
    >
      {loading ? null : children}
    </SettingsContext.Provider>
  );
}
