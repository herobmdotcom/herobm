'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as api from '@modbm/sdk';
import { getErrorMessage } from '@modbm/shared';
import { useSettings } from '../SettingsProvider'; // We'll just fetch appConfig directly since SettingsContext doesn't have it

interface FrontendEnrichmentDecoratorProps {
  field: string;
  country: string;
  value: string;
  isSaving?: boolean;
  onEnrich: (data: any) => void;
}

export function FrontendEnrichmentDecorator({
  field,
  country,
  value,
  isSaving,
  onEnrich,
}: FrontendEnrichmentDecoratorProps) {
  const [provider, setProvider] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const lastEnrichedValue = useRef<string>(value);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load config on mount to see if this field+country has a provider
  useEffect(() => {
    let mounted = true;
    async function loadConfig() {
      try {
        setLoadingConfig(true);
        const res = await api.appConfigControllerGet();
        const config = res.data as any;
        const mappings = config.enrichmentProviderMappings || {};
        const mappedProvider = mappings[field]?.[country];
        
        if (mounted) {
          setProvider(mappedProvider || null);
        }
      } catch (err) {
        // silently ignore config load errors
      } finally {
        if (mounted) setLoadingConfig(false);
      }
    }
    
    if (field && country) {
      loadConfig();
    } else {
      setProvider(null);
      setLoadingConfig(false);
    }
    
    return () => { mounted = false; };
  }, [field, country]);

  // Watch for value changes
  useEffect(() => {
    if (!provider) return;
    
    // If value changes and is different from last enriched, it's pending
    if (value !== lastEnrichedValue.current) {
      if (value.trim() === '') {
        setStatus('idle');
        lastEnrichedValue.current = value;
      } else {
        setStatus('pending');
      }
    }
  }, [value, provider]);

  // Trigger lookup when saving
  useEffect(() => {
    let mounted = true;
    
    async function performLookup() {
      setStatus('loading');
      setErrorMsg('');
      
      try {
        const res = (await api.enrichmentControllerLookup({
          field,
          country,
          query: value,
        })) as any;

        const responseData = res.data ?? res;

        if (mounted) {
          if (responseData && responseData.isValid) {
            setStatus('success');
            lastEnrichedValue.current = value;
            onEnrich(responseData.data);
          } else {
            setStatus('error');
            setErrorMsg(responseData?.data?.error || 'Validation failed');
            lastEnrichedValue.current = value; // Don't retry same invalid value repeatedly
          }
        }
      } catch (err) {
        if (mounted) {
          setStatus('error');
          setErrorMsg(getErrorMessage(err) || 'Lookup failed');
          lastEnrichedValue.current = value;
        }
      }
    }

    if (provider && isSaving && status === 'pending' && value.trim() !== '') {
      performLookup();
    }
    
    return () => { mounted = false; };
  }, [isSaving, status, value, provider, field, country, onEnrich]);

  // Render logic
  if (loadingConfig || !provider) {
    return null; // Don't render anything if no provider mapped
  }

  return (
    <span 
      className="inline-flex items-center ml-2 relative group" 
      title={provider ? `Enrichment provided by ${provider}` : ''}
    >
      {status === 'pending' && (
        <span className="material-symbols-outlined text-[14px] text-amber-500 cursor-help" title="Will verify on save">
          pending
        </span>
      )}
      
      {status === 'loading' && (
        <span className="material-symbols-outlined text-[14px] text-blue-500 animate-spin">
          sync
        </span>
      )}
      
      {status === 'success' && (
        <span className="material-symbols-outlined text-[14px] text-emerald-500 cursor-help" title="Verified">
          check_circle
        </span>
      )}
      
      {status === 'error' && (
        <span className="material-symbols-outlined text-[14px] text-red-500 cursor-help" title={`Verification failed: ${errorMsg}`}>
          error
        </span>
      )}
      
      {/* Tooltip */}
      {status === 'error' && errorMsg && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden md:block">
          {errorMsg}
        </div>
      )}
    </span>
  );
}
