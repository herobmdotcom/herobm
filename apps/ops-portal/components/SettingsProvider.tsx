'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';

interface GlSettings {
  baseCurrency: string;
  fiscalYearStartMonth: number;
  revenueRoutingPrecedence: string;
  expenseRoutingPrecedence: string;
  supportedBatchPaymentFormats: string[];
  defaultArAccountId?: string | null;
  defaultApAccountId?: string | null;
  defaultRevenueAccountId?: string | null;
  defaultExpenseAccountId?: string | null;
}

interface AppSettings {
  defaultFulfillmentLocationId: string | null;
  inventoryValuationMethod: string;
  inventoryAccountingMode: string;
  creditLimitBehavior: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We need any to support dynamic app settings properties that aren't strictly typed yet
  [key: string]: any;
}

interface SettingsContextType {
  gl: GlSettings | null;
  app: AppSettings | null;
  loading: boolean;
  baseCurrency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [organization, setOrganization] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [glRes, orgRes, appRes] = await Promise.all([
          api.glControllerGetSettings(),
          api.organizationControllerGet(),
          api.appConfigControllerGet().catch(() => null)
        ]);
        setGl(glRes.data as unknown as GlSettings);
        setOrganization(orgRes.data);
        if (appRes?.data) {
          console.log('App settings retrieved:', appRes.data);
          setApp(appRes.data as unknown as AppSettings);
        } else {
          console.log('App settings failed to load (appRes is null)');
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
