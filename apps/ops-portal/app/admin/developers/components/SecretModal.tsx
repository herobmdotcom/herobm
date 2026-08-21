'use client';

import React from 'react';
import { Button } from '@/components/shared/Button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';

interface SecretModalProps {
  secret: string | null;
  onClose: () => void;
}

export function SecretModal({ secret, onClose }: SecretModalProps) {
  const tCommon = useTranslations('admin.common');
  const tDev = useTranslations('admin.developers');

  if (!secret) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-lg max-w-lg w-full p-6 border border-[var(--border)] relative">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-[var(--warning)]">
          <span className="material-symbols-outlined text-[24px]">warning</span>
          {/* eslint-disable-next-line no-restricted-syntax -- Temporary literal for webhook */}
          {secret.startsWith('whsec_') ? 'Copy Webhook Secret' : tDev('copyApiKeyWarning')}
        </h3>
        <p className="text-sm text-muted mb-6">
          {tDev('onlyTimeSecretShown')}
        </p>
        <div className="flex items-center gap-2 mb-8">
          <code className="p-4 rounded bg-black/5 text-[var(--text-primary)] font-mono flex-1 text-center border border-[var(--border)] text-lg tracking-wider select-all break-all">
            {secret}
          </code>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            {tCommon('close')}
          </Button>
          <Button
            variant="primary"
            className="bg-[var(--warning)] hover:brightness-110 border-none text-black"
            onClick={() => {
              navigator.clipboard.writeText(secret);
              toast.success(tCommon('copiedToClipboard'));
            }}
          >
            {tCommon('copy')}
          </Button>
        </div>
      </div>
    </div>
  );
}
