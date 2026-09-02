'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import JsonBrowserModal from '@/components/shared/JsonBrowserModal';

function TemplateForm({ initialData, isNew }: { initialData?: Record<string, unknown>, isNew?: boolean }) {
  const t = useTranslations('admin.reporting.form');
  const [formData, setFormData] = useState({
    name: (initialData?.name as string) || '',
    slug: (initialData?.slug as string) || '',
    description: (initialData?.description as string) || '',
    template: (initialData?.template as string) || t('defaults.template'),
    outputNamePattern: (initialData?.outputNamePattern as string) || t('defaults.outputPattern', { context: '{context}', id: '{id}' }),
    contexts: (initialData?.contexts as string[]) || [],
  });
  
  const [previewVars, setPreviewVars] = useState({
    hookSlug: (initialData?.contexts as string[])?.[0] || '',
    entityId: '',
  });
  
  const [availableHooks, setAvailableHooks] = useState<api.HookDto[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contextsOpen, setContextsOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    api.pdfTemplatesControllerGetHooks().then(res => {
      setAvailableHooks(res.data || []);
    }).catch((err) => toast.error('Failed to load PDF hooks: ' + getErrorMessage(err)));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await api.pdfTemplatesControllerCreateReport(formData);
        toast.success(t('toasts.created'));
        router.push('/admin/settings/pdf-templates');
      } else {
        await api.pdfTemplatesControllerUpdateReport(initialData!.id as string, formData);
        toast.success(t('toasts.saved'));
        router.refresh();
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('toasts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('toasts.deleteConfirm'))) return;
    
    setDeleting(true);
    try {
      await api.pdfTemplatesControllerDeleteReport(initialData!.id as string);
      toast.success(t('toasts.deleted'));
      router.push('/admin/settings/pdf-templates');
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('toasts.deleteFailed'));
      setDeleting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await api.pdfTemplatesControllerPreview({
        template: formData.template,
        hookSlug: previewVars.hookSlug,
        entityId: previewVars.entityId
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('toasts.previewFailed'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleRandomizeId = async () => {
    if (!previewVars.hookSlug) return;
    try {
      const res = await api.pdfTemplatesControllerGetRandomId(previewVars.hookSlug);
      const resData = res.data as unknown as { id?: string } | undefined;
      const resDirect = res as unknown as { id?: string } | undefined;
      const newId = resData?.id || resDirect?.id;
      if (newId) {
        setPreviewVars(p => ({ ...p, entityId: newId }));
      } else {
        toast.error('No sample entities found for this hook');
      }
    } catch (err) {
      toast.error('Failed to load sample entity: ' + getErrorMessage(err));
      reportError(err, 'TemplateForm.randomizeId');
    }
  };

  const handleHookChange = (newHookSlug: string) => {
    setPreviewVars(p => ({ ...p, hookSlug: newHookSlug, entityId: '' }));
    if (newHookSlug) {
      // Automatically fetch a random ID when changing hooks
      api.pdfTemplatesControllerGetRandomId(newHookSlug)
        .then((res) => {
          const resData = res.data as unknown as { id?: string } | undefined;
          const resDirect = res as unknown as { id?: string } | undefined;
          const newId = resData?.id || resDirect?.id;
          if (newId) setPreviewVars(p => ({ ...p, hookSlug: newHookSlug, entityId: newId }));
        })
        .catch((err) => {
          reportError(err, 'TemplateForm.handleHookChange');
        });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 h-full overflow-y-auto pr-2">
      {/* Top side: Form & Editor */}
      <div className="flex flex-col gap-4 w-full shrink-0">
        <div className="card p-6 flex flex-col gap-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] font-['Manrope',sans-serif]">
              {isNew ? t('newTemplate') : formData.name}
            </h2>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.displayName')}</label>
              <input className="input w-full" value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.uniqueSlug')}</label>
              <input className="input w-full" value={formData.slug} onChange={e => setFormData(d => ({ ...d, slug: e.target.value }))} placeholder={t('placeholders.slug')} />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.outputPattern')}</label>
              <input className="input w-full" value={formData.outputNamePattern} onChange={e => setFormData(d => ({ ...d, outputNamePattern: e.target.value }))} />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.description')}</label>
              <input className="input w-full" value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.supportedContexts')}</label>
              <div className="relative w-full">
                <div 
                  className="input flex items-center justify-between cursor-pointer font-normal border-[var(--border)]"
                  onClick={() => setContextsOpen(!contextsOpen)}
                >
                  <span className="truncate pr-4 text-sm text-[var(--text-primary)] font-medium">
                    {formData.contexts.length > 0 ? formData.contexts.join(', ') : <span className="text-[var(--text-muted)] font-normal">{t('placeholders.selectContexts')}</span>}
                  </span>
                  {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                  <span className="material-symbols-outlined text-[var(--text-muted)] text-[18px]">{contextsOpen ? 'expand_less' : 'expand_more'}</span>
                </div>
                
                {contextsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextsOpen(false)}></div>
                    <div className="absolute top-[calc(100%+4px)] left-0 w-full min-w-[200px] max-h-60 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border)] rounded-lg z-50 py-1 shadow-xl">
                      {availableHooks.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)] italic p-3">{t('loadingContexts')}</div>
                      ) : (
                        availableHooks.map((h, i) => (
                          <label key={`${h.slug}-${i}`} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors border-b border-[var(--border)] last:border-0">
                            <input 
                              type="checkbox" 
                              className="checkbox checkbox-sm checkbox-primary border-[var(--border)] rounded"
                              checked={formData.contexts.includes(h.slug)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormData(d => ({
                                  ...d,
                                  contexts: checked 
                                    ? [...d.contexts, h.slug] 
                                    : d.contexts.filter(c => c !== h.slug)
                                }));
                              }}
                            />
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">{h.slug}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">
                {t('descriptions.contextHelp')}
              </p>
            </div>
          </div>

          <div className="flex flex-col flex-1 mt-4 min-h-[500px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.typstSource')}</label>
            <textarea 
              className="flex-1 w-full border border-[var(--border)] rounded-lg font-mono text-sm leading-relaxed p-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] whitespace-pre focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] min-h-[500px] resize-y"
              value={formData.template}
              onChange={e => setFormData(d => ({ ...d, template: e.target.value }))}
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button variant="primary" className="px-8 py-3 text-sm font-semibold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110" onClick={handleSave} disabled={saving || deleting}>
              {saving ? t('buttons.saving') : t('buttons.save')}
            </Button>
            {!isNew && (
              <Button 
                variant="secondary" className="px-8 py-3 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all" 
                onClick={handleDelete} 
                disabled={saving || deleting}
              >
                {deleting ? t('buttons.deleting') : t('buttons.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom side: Live Preview */}
      <div className="flex flex-col w-full min-h-[800px] shrink-0">
        <div className="card p-6 flex flex-col gap-4 h-full bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] font-['Manrope',sans-serif]">{t('livePreview.title')}</h3>
            <span className="text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-secondary)] px-2 py-1 rounded">{t('livePreview.badge')}</span>
          </div>
          <div className="flex gap-3 items-end bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border)]">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.contextResolver')}</label>
              <div className="flex gap-2">
                <select className="select flex-1" value={previewVars.hookSlug} onChange={e => handleHookChange(e.target.value)}>
                  <option value="">{t('none')}</option>
                  {availableHooks.map((h, i) => <option key={`preview-${h.slug}-${i}`} value={h.slug}>{h.slug}</option>)}
                </select>
                <Button
                  variant="secondary" className="whitespace-nowrap text-[var(--accent)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/10"
                  onClick={() => setBrowserOpen(true)}
                  disabled={!previewVars.hookSlug}
                >
                  View Data
                </Button>
              </div>
            </div>
            <div className="flex-1 relative">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('labels.targetRecordId')}</label>
              <div className="flex gap-2">
                 <input className="input w-full font-mono text-sm" value={previewVars.entityId} onChange={e => setPreviewVars(p => ({ ...p, entityId: e.target.value }))} placeholder={t('placeholders.uuid')} />
                 <Button variant="secondary" className="px-3" title={t('buttons.getRandomId')} onClick={handleRandomizeId} disabled={!previewVars.hookSlug}>
                   🎲
                 </Button>
              </div>
            </div>
            <Button variant="secondary" className="w-36 px-4 py-2 text-sm font-semibold rounded-lg transition-all btn btn-secondary" disabled={previewing || !previewVars.entityId} onClick={handlePreview}>
               {previewing ? t('buttons.compiling') : t('buttons.generatePdf')}
            </Button>
          </div>
          
          <div className="flex-1 border border-[var(--border)] rounded-lg bg-black/20 overflow-hidden relative">
            {pdfBlobUrl ? (
              <iframe src={`${pdfBlobUrl}#toolbar=0`} className="w-[100%] h-[100%] border-0 object-contain bg-[#525659]" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span className="font-semibold text-sm">{t('livePreview.waiting')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <JsonBrowserModal 
        isOpen={browserOpen} 
        onClose={() => setBrowserOpen(false)} 
        hookSlug={previewVars.hookSlug} 
        type="record"
      />
    </div>
  );
}

export default TemplateForm;
