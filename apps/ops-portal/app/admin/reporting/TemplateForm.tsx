'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchBlob, apiMutate } from '@/lib/api';

export default function TemplateForm({ initialData }: { initialData?: any }) {
  const isNew = !initialData;
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    template: initialData?.template || '#set page(paper: "a4")\n\n= Standard Report\n',
    outputNamePattern: initialData?.outputNamePattern || 'Report-${id}.pdf',
  });
  
  const [previewVars, setPreviewVars] = useState({
    hookSlug: 'sales-order-quote',
    entityId: '',
  });
  
  const [availableHooks, setAvailableHooks] = useState<any[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    apiFetch<{ data: any[] }>('/api/reports/hooks').then(res => setAvailableHooks(res.data)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      if (isNew) {
        await apiMutate('/api/reports', 'POST', formData);
        router.push('/admin/reporting');
      } else {
        await apiMutate(`/api/reports/${initialData.id}`, 'PATCH', formData);
        router.refresh();
        alert('Saved successfully!');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setErrorMsg('');
    try {
      const blob = await apiFetchBlob('/api/reports/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: formData.template,
          hookSlug: previewVars.hookSlug,
          entityId: previewVars.entityId
        })
      });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (e: any) {
      setErrorMsg(e.message || 'Preview generation failed. Check typo in template or missing ID data.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleRandomizeId = async () => {
    if (!previewVars.hookSlug) return;
    try {
      const res = await apiFetch<{ data: { id: string | null } }>(`/api/reports/hooks/${previewVars.hookSlug}/random-id`);
      if (res.data.id) {
        setPreviewVars(p => ({ ...p, entityId: res.data.id! }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleHookChange = (newHookSlug: string) => {
    setPreviewVars(p => ({ ...p, hookSlug: newHookSlug, entityId: '' }));
    if (newHookSlug) {
      // Automatically fetch a random ID when changing hooks
      apiFetch<{ data: { id: string | null } }>(`/api/reports/hooks/${newHookSlug}/random-id`)
        .then(res => {
          if (res.data.id) setPreviewVars(p => ({ ...p, hookSlug: newHookSlug, entityId: res.data.id! }));
        })
        .catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 h-full overflow-y-auto pr-2">
      {/* Top side: Form & Editor */}
      <div className="flex flex-col gap-4 w-full shrink-0">
        <div className="card p-6 flex flex-col gap-4 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/admin/reporting')} 
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors flex items-center justify-center shrink-0"
              title="Return to Reporting List"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {isNew ? 'Create New Template' : `Editing: ${formData.name}`}
            </h2>
          </div>
          {errorMsg && <div className="text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 text-sm font-semibold">{errorMsg}</div>}
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
              <input className="input w-full" value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unique Slug</label>
              <input className="input w-full" value={formData.slug} onChange={e => setFormData(d => ({ ...d, slug: e.target.value }))} placeholder="e.g. default-quote" />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Output Filename Pattern</label>
              <input className="input w-full" value={formData.outputNamePattern} onChange={e => setFormData(d => ({ ...d, outputNamePattern: e.target.value }))} />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
              <input className="input w-full" value={formData.description} onChange={e => setFormData(d => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          
          <div className="flex flex-col flex-1 mt-4 min-h-[500px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Typst Source Code</label>
            <textarea 
              className="flex-1 w-full border border-[rgba(196,198,205,0.4)] rounded-lg font-mono text-sm leading-relaxed p-4 bg-[#f8f9fa] whitespace-pre focus:outline-none focus:ring-2 focus:ring-[#006b5c]/30 focus:border-[#006b5c]"
              value={formData.template}
              onChange={e => setFormData(d => ({ ...d, template: e.target.value }))}
              spellCheck={false}
              style={{ minHeight: '500px', resize: 'vertical' }}
            />
          </div>

          <button className="btn btn-primary self-start mt-4 px-8 py-3 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Bottom side: Live Preview */}
      <div className="flex flex-col w-full min-h-[800px] shrink-0">
        <div className="card p-6 flex flex-col gap-4 h-full bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>Live Preview</h3>
            <span className="text-xs text-gray-400 font-semibold bg-gray-100 px-2 py-1 rounded">Typst Compiler</span>
          </div>
          <div className="flex gap-3 items-end bg-[#f8f9fa] p-4 rounded-lg border border-[rgba(196,198,205,0.4)]">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Context Resolver</label>
              <select className="select w-full bg-white" value={previewVars.hookSlug} onChange={e => handleHookChange(e.target.value)}>
                <option value="">-- None --</option>
                {availableHooks.map(h => (
                  <option key={h.contextSlug} value={h.contextSlug}>{h.contextSlug}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target Record ID</label>
              <div className="flex gap-2">
                 <input className="input w-full bg-white font-mono text-sm" value={previewVars.entityId} onChange={e => setPreviewVars(p => ({ ...p, entityId: e.target.value }))} placeholder="UUID..." />
                 <button className="btn btn-secondary px-3 bg-white" title="Get Random ID" onClick={handleRandomizeId} disabled={!previewVars.hookSlug}>
                   🎲
                 </button>
              </div>
            </div>
            <button className="btn btn-secondary w-36 px-4 py-2 text-sm font-bold rounded-lg transition-all bg-white border border-[#041627] text-[#041627] hover:bg-gray-50" disabled={previewing || !previewVars.entityId} onClick={handlePreview}>
               {previewing ? 'Compiling...' : 'Generate PDF'}
            </button>
          </div>
          
          <div className="flex-1 border border-[rgba(196,198,205,0.4)] rounded-lg bg-gray-200/50 overflow-hidden relative shadow-inner">
            {pdfBlobUrl ? (
              <iframe src={`${pdfBlobUrl}#toolbar=0`} className="w-[100%] h-[100%] border-0 object-contain" style={{ backgroundColor: '#525659' }} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span className="font-semibold text-sm">Waiting for compilation...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
