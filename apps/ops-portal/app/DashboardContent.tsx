'use client';

import React, { useState, useEffect } from 'react';
import UniversalSearch from '@/components/shared/UniversalSearch';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import DashboardTimeline from './DashboardTimeline';
import TimelineSettingsSlideOver, { DEFAULT_ENABLED_EVENTS, EventType } from './TimelineSettingsSlideOver';

export default function DashboardContent() {
  const t = useTranslations('dashboard');
  const tTimeline = useTranslations('dashboard.timeline');
  const [isTimelineSettingsOpen, setIsTimelineSettingsOpen] = useState(false);
  const [enabledEvents, setEnabledEvents] = useState<EventType[]>(DEFAULT_ENABLED_EVENTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('modbm_timeline_preferences');
      if (stored) {
        setEnabledEvents(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Failed to load timeline preferences', err);
    }
    setIsLoaded(true);
  }, []);

  const handlePreferencesChange = (events: EventType[]) => {
    setEnabledEvents(events);
    try {
      localStorage.setItem('modbm_timeline_preferences', JSON.stringify(events));
    } catch (err) {
      console.warn('Failed to save timeline preferences', err);
    }
  };

  return (
    <>
      <div className="p-8 h-full overflow-y-auto lg:overflow-x-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">{t('title')}</h2>
          
          <div className="mb-12">
            <UniversalSearch />
          </div>

          <div className="flex flex-col gap-12">
            <div className="w-full">
              <div className="flex items-center gap-2 mb-6 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-primary)' }}>
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {t('quickActions.title')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  href="/sales-orders/new"
                  className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border flex flex-col gap-5 cursor-pointer no-underline"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(0, 107, 92, 0.08)' }}
                  >
                    <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent)' }}>receipt_long</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {t('quickActions.createSalesOrder')}
                    </div>
                    <div className="text-[13px] opacity-60 mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {t('quickActions.createSalesDesc')}
                    </div>
                  </div>
                </Link>

                <Link
                  href="/purchase-orders/new"
                  className="group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border flex flex-col gap-5 cursor-pointer no-underline"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(0, 107, 92, 0.08)' }}
                  >
                    <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent)' }}>local_shipping</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] group-hover:text-accent transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {t('quickActions.createPurchaseOrder')}
                    </div>
                    <div className="text-[13px] opacity-60 mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {t('quickActions.createPurchaseDesc')}
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="w-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-primary)' }}>
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  {tTimeline('title')}
                </div>
                
                <button 
                  onClick={() => setIsTimelineSettingsOpen(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                  title={tTimeline('settings')}
                >
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300">settings</span>
                </button>
              </div>

              <div className="flex-1 min-h-[400px]">
                {isLoaded && <DashboardTimeline enabledEvents={enabledEvents} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoaded && (
        <TimelineSettingsSlideOver 
          isOpen={isTimelineSettingsOpen}
          onClose={() => setIsTimelineSettingsOpen(false)}
          enabledEvents={enabledEvents}
          onChange={handlePreferencesChange}
        />
      )}
    </>
  );
}
