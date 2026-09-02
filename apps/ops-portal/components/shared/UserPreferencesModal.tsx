'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/AuthGate';
import { useUserSettings } from '@/components/UserSettingsProvider';
import SlideOver from './SlideOver';
import { Button } from './Button';
import { getErrorMessage, type DisplayDensity, type ThemeMode } from '@herobm/shared';
import * as api from '@herobm/sdk';

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const t = useTranslations('common.preferences');
  const t2fa = useTranslations('common.preferences.twoFactor');
  const { role, username, displayName } = useAuth();
  const { density, theme, updatePreferences } = useUserSettings();

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading2Fa, setLoading2Fa] = useState(true);
  const [setupStep, setSetupStep] = useState<0 | 1 | 2 | 3 | 'disable' | 'regenerate'>(0);
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [backupCodesConfirmed, setBackupCodesConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setPassword('');
      setSetupError(null);
      setBackupCodesConfirmed(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleDensityChange = async (newDensity: DisplayDensity) => {
    if (newDensity === density) return;
    try {
      await updatePreferences({ density: newDensity });
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveFailed'));
    }
  };

  const handleThemeChange = async (newTheme: ThemeMode) => {
    if (newTheme === theme) return;
    try {
      await updatePreferences({ theme: newTheme });
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveFailed'));
    }
  };

  const handleStart2FaSetup = async () => {
    try {
      const res = await api.authControllerSetup2Fa({});
      const d = res.data;
      if (d) setSetupData({ secret: d.secret, qrCodeDataUrl: d.qrCodeDataUrl, backupCodes: d.backupCodes });
      setSetupError(null);
      setSetupCode('');
      setPassword('');
      setSetupStep(1);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to initialize 2FA setup');
    }
  };

  const handleVerify2FaSetup = async () => {
    if (!setupCode || setupCode.length < 6 || !setupData) return;
    setSetupError(null);
    setSubmitting(true);
    try {
      await api.authControllerEnable2Fa({ code: setupCode, secret: setupData.secret });
      setSetupStep(3);
      setTwoFactorEnabled(true);
    } catch (err: unknown) {
      setSetupError(getErrorMessage(err) || t2fa('invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartDisable2Fa = () => {
    setSetupStep('disable');
    setPassword('');
    setSetupCode('');
    setSetupError(null);
  };

  const handleConfirmDisable2Fa = async () => {
    if (!password || !setupCode || setupCode.length < 6) return;
    setSetupError(null);
    setSubmitting(true);
    try {
      await api.authControllerDisable2Fa({ password, code: setupCode });
      setTwoFactorEnabled(false);
      setSetupStep(0);
      setPassword('');
      setSetupCode('');
      toast.success(t2fa('disableSuccess'));
    } catch (err: unknown) {
      setSetupError(getErrorMessage(err) || t2fa('invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartRegenerateBackupCodes = () => {
    setSetupStep('regenerate');
    setPassword('');
    setSetupCode('');
    setSetupError(null);
  };

  const handleConfirmRegenerateBackupCodes = async () => {
    if (!password || !setupCode || setupCode.length < 6) return;
    setSetupError(null);
    setSubmitting(true);
    try {
      const res = await api.authControllerRegenerateBackupCodes({ password, code: setupCode });
      const d = res.data;
      if (d) setSetupData({ secret: '', qrCodeDataUrl: '', backupCodes: d.backupCodes });
      setSetupStep(3);
      setPassword('');
      setSetupCode('');
      setBackupCodesConfirmed(false);
    } catch (err: unknown) {
      setSetupError(getErrorMessage(err) || t2fa('invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      width="max-w-md"
    >
      <div className="flex flex-col gap-6">
        {/* User Identity Info */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('userProfile')}
          </label>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{t('username')}</span>
              <span className="font-medium text-[var(--text-primary)]">{username}</span>
            </div>
            {displayName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">{t('displayName')}</span>
                <span className="font-medium text-[var(--text-primary)]">{displayName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{t('role')}</span>
              <span className="font-medium text-[var(--text-primary)] capitalize">{role}</span>
            </div>
          </div>
        </div>

        {/* Display Density */}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('density')}
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Comfortable */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                density === 'comfortable'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <input
                type="radio"
                name="display-density"
                value="comfortable"
                checked={density === 'comfortable'}
                onChange={() => handleDensityChange('comfortable')}
                className="mt-0.5 accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
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
                density === 'compact'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              <input
                type="radio"
                name="display-density"
                value="compact"
                checked={density === 'compact'}
                onChange={() => handleDensityChange('compact')}
                className="mt-0.5 accent-[var(--accent)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
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

        {/* Appearance / Theme */}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('theme')}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {/* System */}
            <label
              className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all text-center gap-1.5 ${
                theme === 'system'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <input
                type="radio"
                name="display-theme"
                value="system"
                checked={theme === 'system'}
                onChange={() => handleThemeChange('system')}
                className="sr-only"
              />
              <span className={`material-symbols-outlined text-[22px] ${theme === 'system' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                desktop_windows
              </span>
              <span className="text-xs font-semibold">
                {t('themeSystem')}
              </span>
            </label>

            {/* Light */}
            <label
              className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all text-center gap-1.5 ${
                theme === 'light'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <input
                type="radio"
                name="display-theme"
                value="light"
                checked={theme === 'light'}
                onChange={() => handleThemeChange('light')}
                className="sr-only"
              />
              <span className={`material-symbols-outlined text-[22px] ${theme === 'light' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                light_mode
              </span>
              <span className="text-xs font-semibold">
                {t('themeLight')}
              </span>
            </label>

            {/* Dark */}
            <label
              className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all text-center gap-1.5 ${
                theme === 'dark'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <input
                type="radio"
                name="display-theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={() => handleThemeChange('dark')}
                className="sr-only"
              />
              <span className={`material-symbols-outlined text-[22px] ${theme === 'dark' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                dark_mode
              </span>
              <span className="text-xs font-semibold">
                {t('themeDark')}
              </span>
            </label>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {theme === 'system' ? t('themeSystemDesc') : theme === 'dark' ? t('themeDarkDesc') : t('themeLightDesc')}
          </p>
        </div>

        {/* 2FA Section */}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t2fa('security')}
          </label>
          {!loading2Fa && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  {t2fa('title')}
                </h4>
                <label className="switch" title={t2fa('title')}>
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled || setupStep === 1 || setupStep === 2 || setupStep === 3 || setupStep === 'regenerate'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleStart2FaSetup();
                      } else {
                        if (twoFactorEnabled) {
                          handleStartDisable2Fa();
                        } else {
                          setSetupStep(0);
                          setSetupData(null);
                        }
                      }
                    }}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              {setupStep === 0 && twoFactorEnabled && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    {t2fa('enabled')}
                  </p>
                  <div className="flex">
                    <Button variant="secondary" size="sm" onClick={handleStartRegenerateBackupCodes}>
                      {t2fa('regenerateBackupCodes')}
                    </Button>
                  </div>
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
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSetupStep(0);
                        setSetupData(null);
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => { setSetupStep(2); setSetupError(null); }}>
                      Next
                    </Button>
                  </div>
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
                    onChange={(e) => {
                      setSetupCode(e.target.value);
                      if (setupError) setSetupError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && setupCode.length >= 6 && !submitting) {
                        handleVerify2FaSetup();
                      }
                    }}
                    placeholder="123456"
                    autoFocus
                  />
                  {setupError && (
                    <p className="text-xs text-[var(--danger,#ef4444)] font-medium">
                      {setupError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setSetupStep(1); setSetupError(null); }}>
                      Back
                    </Button>
                    <Button variant="primary" onClick={handleVerify2FaSetup} disabled={setupCode.length < 6 || submitting}>
                      {submitting ? '...' : t2fa('enable')}
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
                  <Button
                    variant="primary"
                    disabled={!backupCodesConfirmed}
                    onClick={() => {
                      setSetupStep(0);
                      setSetupData(null);
                      setBackupCodesConfirmed(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              )}

              {setupStep === 'disable' && (
                <div className="flex flex-col gap-4">
                  <h5 className="text-sm font-medium text-[var(--danger,#ef4444)]">{t2fa('disable')}</h5>
                  <p className="text-xs text-[var(--text-muted)]">{t2fa('disableConfirm')}</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {t2fa('enterPassword')}
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (setupError) setSetupError(null);
                      }}
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {t2fa('enterVerificationCode')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={setupCode}
                      onChange={(e) => {
                        setSetupCode(e.target.value);
                        if (setupError) setSetupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && password && setupCode.length >= 6 && !submitting) {
                          handleConfirmDisable2Fa();
                        }
                      }}
                      placeholder="123456"
                    />
                  </div>
                  {setupError && (
                    <p className="text-xs text-[var(--danger,#ef4444)] font-medium">
                      {setupError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSetupStep(0);
                        setPassword('');
                        setSetupCode('');
                        setSetupError(null);
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleConfirmDisable2Fa}
                      disabled={!password || setupCode.length < 6 || submitting}
                    >
                      {submitting ? '...' : t2fa('disable')}
                    </Button>
                  </div>
                </div>
              )}

              {setupStep === 'regenerate' && (
                <div className="flex flex-col gap-4">
                  <h5 className="text-sm font-medium">{t2fa('regenerateBackupCodes')}</h5>
                  <p className="text-xs text-[var(--text-muted)]">{t2fa('regenerateDesc')}</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {t2fa('enterPassword')}
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (setupError) setSetupError(null);
                      }}
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {t2fa('enterVerificationCode')}
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={setupCode}
                      onChange={(e) => {
                        setSetupCode(e.target.value);
                        if (setupError) setSetupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && password && setupCode.length >= 6 && !submitting) {
                          handleConfirmRegenerateBackupCodes();
                        }
                      }}
                      placeholder="123456"
                    />
                  </div>
                  {setupError && (
                    <p className="text-xs text-[var(--danger,#ef4444)] font-medium">
                      {setupError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSetupStep(0);
                        setPassword('');
                        setSetupCode('');
                        setSetupError(null);
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleConfirmRegenerateBackupCodes}
                      disabled={!password || setupCode.length < 6 || submitting}
                    >
                      {submitting ? '...' : t2fa('regenerate')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}
