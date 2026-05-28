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
  nonStockBillingMode: string;
  creditLimitBehavior: string;
}

interface SettingsContextType {
  gl: GlSettings | null;
  app: AppSettings | null;
  loading: boolean;
  baseCurrency: string;
}

const SettingsContext = createContext<SettingsContextType>({
  gl: null,
  app: null,
  loading: true,
  baseCurrency: 'EUR', // Fallback, shouldn't be used if loading blocks render
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [gl, setGl] = useState<GlSettings | null>(null);
  const [app, setApp] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.glControllerGetSettings();
        setGl(res.data as unknown as GlSettings);
      } catch (err: any) {
        if (err.message !== 'Not authenticated' && err.status !== 401 && err.status !== 403) {
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
      }}
    >
      {loading ? null : children}
    </SettingsContext.Provider>
  );
}
