'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import { projectsControllerCreate, projectsControllerUpdate, projectsControllerFindOne } from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { useSettings } from '@/components/SettingsProvider';

import { toast } from 'react-hot-toast';

interface ProjectFormProps {
  isNew?: boolean;
  projectId?: string;
}

export default function ProjectForm({ isNew, projectId }: ProjectFormProps) {
  const router = useRouter();
  const tCommon = useTranslations();
  const [loading, setLoading] = useState(false);
  const { app: appSettings } = useSettings();
  
  const [dto, setDto] = useState({
    name: '',
    type: 'buy_side',
    status: 'prospect',
  });

  useEffect(() => {
    if (!isNew && projectId) {
      setLoading(true);
      projectsControllerFindOne(projectId)
        .then((res) => {
          if (res?.data) {
            setDto({
              name: res.data.name || '',
              type: res.data.type || 'buy_side',
              status: res.data.status || 'prospect',
            });
          }
        })
        .catch((err) => {
          toast.error('Failed to load project');
          reportError(err, 'ProjectForm');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isNew, projectId]);

  async function handleSubmit() {
    if (!dto.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setLoading(true);
    try {
      if (isNew) {
        const res = await projectsControllerCreate(dto);
        toast.success('Project created');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic response
        router.push(`/crm/projects/${(res as any).data?.projectId || ''}`);
      } else {
        if (!projectId) throw new Error('Missing projectId');
        await projectsControllerUpdate(projectId, dto);
        toast.success('Project updated');
        router.push('/crm/projects');
      }
    } catch (err) {
      toast.error('An error occurred');
      reportError(err, 'ProjectForm');
    } finally {
      setLoading(false);
    }
  }

  const updateField = (field: string, value: string) => {
    setDto((prev) => ({ ...prev, [field]: value }));
  };

  const title = isNew ? 'Create Project' : 'Edit Project';

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={title}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.back()}
                disabled={loading}
              >
                {tCommon('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={loading || !dto.name.trim()}
              >
                {loading ? tCommon('common.saving') : (isNew ? 'Create Project' : 'Save')}
              </Button>
            </>
          }
          showPrint={false}
        />
      }
    >
      <div className="max-w-5xl flex flex-col gap-3 mb-6">
        {/* General Info Card */}
        <div className="card">
          <h3 className="section-heading">
            <span className="material-symbols-outlined">info</span>
            GENERAL INFO
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Name *
                </label>
                <input
                  type="text"
                  className="input"
                  value={dto.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. Project Apollo"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Type *
                </label>
                <select
                  className="input"
                  value={dto.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  disabled={loading}
                >
                  {[...(appSettings?.projectTypes || [])].sort((a, b) => Number(a.order) - Number(b.order)).map((t) => (
                    <option key={t.value} value={t.value}>{t.value}</option>
                  ))}
                  {!appSettings?.projectTypes?.length && (
                    <>
                      <option value="buy_side">Buy Side M&A</option>
                      <option value="sell_side">Sell Side M&A</option>
                      <option value="advisory">Advisory</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Status
                </label>
                <select
                  className="input"
                  value={dto.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  disabled={loading}
                >
                  {[...(appSettings?.projectStatuses || [])].sort((a, b) => Number(a.order) - Number(b.order)).map((s) => (
                    <option key={s.value} value={s.value}>{s.value}</option>
                  ))}
                  {!appSettings?.projectStatuses?.length && (
                    <>
                      <option value="prospect">Prospect</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="lost">Lost</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DetailsLayout>
  );
}
