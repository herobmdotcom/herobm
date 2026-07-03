'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { Button } from '@/components/shared/Button';
import { getErrorMessage } from '@herobm/shared';

export default function SmtpSettingsPage() {
  useDocumentTitle('SMTP Settings');

  const [form, setForm] = useState<Partial<api.AppConfigResponseDto>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.appConfigControllerGet();
      setForm(res.data);
    } catch (err: unknown) {
      toast.error('Failed to load settings: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = async (field: keyof api.AppConfigResponseDto, value: unknown) => {
    try {
      setForm((prev) => ({ ...prev, [field]: value }));
      
      const payload: Partial<api.AppConfigResponseDto> = { [field]: value };
      
      // If we're updating port, ensure it's a number
      if (field === 'smtpPort' && value) {
        payload[field] = Number(value);
      }
      
      await api.appConfigControllerUpdate(payload as unknown as api.UpdateAppConfigDto);
      toast.success('Updated ' + field);
    } catch (err: unknown) {
      toast.error('Failed to update: ' + getErrorMessage(err));
    }
  };

  const testConnection = async () => {
    try {
      const toastId = toast.loading('Testing connection...');
      await api.emailControllerTestConnection();
      toast.success('SMTP connection successful', { id: toastId });
    } catch (err: unknown) {
      toast.error('Test failed: ' + getErrorMessage(err));
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="SMTP Settings"
          subtitle="Configure outbound email server"
          showPrint={false}
          actions={
            <Button variant="secondary" onClick={testConnection}>
              Test Connection
            </Button>
          }
        />
      }
    >
      <div className="flex flex-col gap-6" style={{ maxWidth: 800 }}>
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI icon */}
            <span className="material-symbols-outlined">dns</span>
            Server Configuration
          </h3>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    SMTP Host
                  </label>
                  <input
                    className="input"
                    value={form.smtpHost || ''}
                    onChange={(e) => setForm(f => ({ ...f, smtpHost: e.target.value }))}
                    onBlur={(e) => updateField('smtpHost', e.target.value)}
                    placeholder="e.g. smtp.mailgun.org"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    SMTP Port
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={form.smtpPort || ''}
                    onChange={(e) => setForm(f => ({ ...f, smtpPort: e.target.value ? Number(e.target.value) : undefined }))}
                    onBlur={(e) => updateField('smtpPort', e.target.value ? Number(e.target.value) : null)}
                    placeholder="e.g. 587 or 465"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    SMTP User
                  </label>
                  <input
                    className="input"
                    value={form.smtpUser || ''}
                    onChange={(e) => setForm(f => ({ ...f, smtpUser: e.target.value }))}
                    onBlur={(e) => updateField('smtpUser', e.target.value)}
                    placeholder="e.g. postmaster@yourdomain.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    SMTP Password
                  </label>
                  <input
                    className="input"
                    type="password"
                    value={form.smtpPass || ''}
                    onChange={(e) => setForm(f => ({ ...f, smtpPass: e.target.value }))}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value !== '********') {
                        updateField('smtpPass', e.target.value);
                      }
                    }}
                    placeholder="Leave blank to keep existing password"
                  />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Password is encrypted in the database.
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 md:w-1/2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  From Address
                </label>
                <input
                  className="input"
                  value={form.smtpFromAddress || ''}
                  onChange={(e) => setForm(f => ({ ...f, smtpFromAddress: e.target.value }))}
                  onBlur={(e) => updateField('smtpFromAddress', e.target.value)}
                  placeholder="e.g. noreply@yourdomain.com"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}
