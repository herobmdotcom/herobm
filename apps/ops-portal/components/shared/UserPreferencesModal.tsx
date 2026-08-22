'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthGate';
import { useUserSettings } from '@/components/UserSettingsProvider';
import SlideOver from './SlideOver';
import { Button } from './Button';
import type { DisplayDensity } from '@herobm/shared';
import * as api from '@herobm/sdk';

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const t = useTranslations('common.preferences');
  const t2fa = useTranslations('common.preferences.twoFactor');
  const tCommon = useTranslations('common');
  const { role, username, displayName } = useAuth();
  const { preferences, updatePreferences } = useUserSettings();

  const [selectedDensity, setSelectedDensity] = useState<DisplayDensity>(
    preferences.density === 'compact' ? 'compact' : 'comfortable',
  );
  const [isSaving, setIsSaving] = useState(false);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading2Fa, setLoading2Fa] = useState(true);
  const [setupStep, setSetupStep] = useState<0 | 1 | 2 | 3>(0);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [backupCodesConfirmed, setBackupCodesConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading2Fa(true);
      api.authControllerGet2FaStatus()
        .then(res => {
          setTwoFactorEnabled(res.data.enabled);
          setLoading2Fa(false);
        })
        .catch(() => setLoading2Fa(false));
    } else {
      setSetupStep(0);
      setSetupData(null);
      setSetupCode('');
      setBackupCodesConfirmed(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({ density: selectedDensity });
      toast.success(t('saved'));
      onClose();
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStart2FaSetup = async () => {
    try {
      const res = await api.authControllerSetup2Fa({});
      const d = res.data;
      if (d) setSetupData({ secret: d.secret, qrCodeDataUrl: d.qrCodeDataUrl, backupCodes: d.backupCodes });
      setSetupStep(1);
    } catch (err) {
      toast.error('Failed to initialize 2FA setup');
    }
  };

  const handleVerify2FaSetup = async () => {
    if (!setupCode || setupCode.length < 6 || !setupData) return;
    try {
      await api.authControllerEnable2Fa({ code: setupCode, secret: setupData.secret });
      setSetupStep(3);
      setTwoFactorEnabled(true);
    } catch (err) {
      toast.error('Invalid code');
    }
  };

  const handleDisable2Fa = async () => {
    if (!window.confirm(t2fa('disableConfirm'))) return;
    const password = window.prompt(t2fa('enterPassword'));
    if (!password) return;
    const code = window.prompt(t2fa('enterVerificationCode'));
    if (!code) return;
    
    try {
      await api.authControllerDisable2Fa({ password, code });
      setTwoFactorEnabled(false);
      toast.success('2FA Disabled');
    } catch (err) {
      toast.error('Failed to disable 2FA');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const password = window.prompt(t2fa('enterPassword'));
    if (!password) return;
    const code = window.prompt(t2fa('enterVerificationCode'));
    if (!code) return;
    
    try {
      const res = await api.authControllerRegenerateBackupCodes({ password, code });
      const d = res.data;
      if (d) setSetupData({ secret: '', qrCodeDataUrl: '', backupCodes: d.backupCodes });
      setSetupStep(3);
    } catch (err) {
      toast.error('Failed to regenerate backup codes');
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      width="max-w-md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
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
        {/* User Identity Info */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('userProfile')}
          </label>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">{t('username')}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{username}</span>
            </div>
            {displayName && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Display Name</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{displayName}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">{t('role')}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] capitalize">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Display Density */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('density')}
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Comfortable */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                selectedDensity === 'comfortable'
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <input
                type="radio"
                name="display-density"
                value="comfortable"
                checked={selectedDensity === 'comfortable'}
                onChange={() => setSelectedDensity('comfortable')}
                className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {t('densityComfortable')}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {t('densityComfortableDesc')}
                </span>
              </div>
            </label>

            {/* Compact */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                selectedDensity === 'compact'
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <input
                type="radio"
                name="display-density"
                value="compact"
                checked={selectedDensity === 'compact'}
                onChange={() => setSelectedDensity('compact')}
                className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {t('densityCompact')}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {t('densityCompactDesc')}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* 2FA Section */}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t2fa('security')}
          </label>
          {!loading2Fa && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t2fa('title')}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {/* eslint-disable-next-line no-restricted-syntax -- i18n translation key name matches state name */}
                    {twoFactorEnabled ? t2fa('enabled') : t2fa('inactive')}
                  </p>
                </div>
                {twoFactorEnabled && (
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-green-500/10 text-green-500 border border-green-500/20">
                    {/* eslint-disable-next-line no-restricted-syntax -- i18n translation key name matches state name */}
                    {t2fa('active')}
                  </span>
                )}
              </div>

              {setupStep === 0 && !twoFactorEnabled && (
                <Button variant="primary" onClick={handleStart2FaSetup}>
                  {t2fa('enable')}
                </Button>
              )}

              {setupStep === 0 && twoFactorEnabled && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleRegenerateBackupCodes}>
                    {t2fa('regenerateBackupCodes')}
                  </Button>
                  <Button variant="danger" onClick={handleDisable2Fa}>
                    {t2fa('disable')}
                  </Button>
                </div>
              )}

              {setupStep === 1 && setupData && (
                <div className="flex flex-col gap-4">
                  <h5 className="text-sm font-medium">{t2fa('setupStep1')}</h5>
                  <p className="text-xs text-[var(--text-muted)]">{t2fa('scanQrCode')}</p>
                  <div className="bg-white p-2 w-fit rounded">
                    <img src={setupData.qrCodeDataUrl} alt="QR Code" className="w-32 h-32" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">{t2fa('manualEntry')}</p>
                    <code className="text-xs bg-[var(--bg-secondary)] p-1 rounded font-mono">{setupData.secret}</code>
                  </div>
                  <Button variant="primary" onClick={() => setSetupStep(2)}>
                    Next
                  </Button>
                </div>
              )}

              {setupStep === 2 && (
                <div className="flex flex-col gap-4">
                  <h5 className="text-sm font-medium">{t2fa('setupStep2')}</h5>
                  <p className="text-xs text-[var(--text-muted)]">{t2fa('enterVerificationCode')}</p>
                  <input
                    type="text"
                    className="input"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    placeholder="123456"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setSetupStep(1)}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={handleVerify2FaSetup} disabled={setupCode.length < 6}>
                      {t2fa('enable')}
                    </Button>
                  </div>
                </div>
              )}

              {setupStep === 3 && setupData && (
                <div className="flex flex-col gap-4">
                  <h5 className="text-sm font-medium">{t2fa('setupStep3')}</h5>
                  <p className="text-xs text-[var(--text-danger)]">{t2fa('backupCodesWarning')}</p>
                  <div className="bg-[var(--bg-secondary)] p-3 rounded grid grid-cols-2 gap-2 font-mono text-sm">
                    {setupData.backupCodes.map((c, i) => (
                      <div key={i}>{c}</div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
                      toast.success('Copied!');
                    }}
                  >
                    {t2fa('copyAll')}
                  </Button>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={backupCodesConfirmed}
                      onChange={(e) => setBackupCodesConfirmed(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">{t2fa('backupCodesConfirm')}</span>
                  </label>
                  <Button variant="primary" disabled={!backupCodesConfirmed} onClick={() => setSetupStep(0)}>
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Display Density Preference */}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
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
