'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthGate';
import { useUserSettings } from '@/components/UserSettingsProvider';
import SlideOver from './SlideOver';
import { Button } from './Button';
import type { DisplayDensity } from '@herobm/shared';

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const t = useTranslations('common.preferences');
  const tCommon = useTranslations('common');
  const { role, username, displayName } = useAuth();
  const { preferences, updatePreferences } = useUserSettings();

  const [selectedDensity, setSelectedDensity] = useState<DisplayDensity>(
    preferences.density === 'compact' ? 'compact' : 'comfortable',
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        density: selectedDensity,
      });
      toast.success(t('saved'));
      onClose();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Profile Info */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('userProfile')}
          </label>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('username')}
              </label>
              <input
                type="text"
                readOnly
                value={displayName || username || ''}
                className="input cursor-default bg-transparent text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {t('role')}
              </label>
              <input
                type="text"
                readOnly
                value={role ? role.charAt(0).toUpperCase() + role.slice(1) : ''}
                className="input cursor-default bg-transparent text-[var(--text-primary)] capitalize"
              />
            </div>
          </div>
        </div>

        {/* Display Density Preference */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('density')}
          </label>
          <div className="grid grid-cols-1 gap-3">
            {/* Comfortable */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedDensity === 'comfortable'
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <input
                type="radio"
                name="density"
                value="comfortable"
                checked={selectedDensity === 'comfortable'}
                onChange={() => setSelectedDensity('comfortable')}
                className="mt-1 accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('densityComfortable')}
                </span>
                <span className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t('densityComfortableDesc')}
                </span>
              </div>
            </label>

            {/* Compact */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedDensity === 'compact'
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <input
                type="radio"
                name="density"
                value="compact"
                checked={selectedDensity === 'compact'}
                onChange={() => setSelectedDensity('compact')}
                className="mt-1 accent-[var(--accent)] cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {t('densityCompact')}
                </span>
                <span className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t('densityCompactDesc')}
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
