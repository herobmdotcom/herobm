'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { formatLocalDate } from '@/lib/date';
import { Button } from '@/components/shared/Button';
import Tabs, { type TabItem } from '@/components/shared/Tabs';
import PageNav, { PageSection } from '@/components/shared/PageNav';
import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';

type FragmentTab = 'customer-header' | 'customer-footer' | 'supplier-header' | 'supplier-footer';

interface Assignment {
  hookSlug: string;
  reportId: string | null;
  contextSlug: string | null;
  reportName?: string | null;
}

interface ReportTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  template: string;
  outputNamePattern?: string | null;
  contexts?: string[];
  lastModifiedOn?: string | null;
  updatedAt?: string | null;
}

const PRESET_FONTS = [
  { value: 'DejaVu Sans', label: 'DejaVu Sans (Sans-Serif, Default)' },
  { value: 'Liberation Sans', label: 'Liberation Sans (Clean Sans-Serif)' },
  { value: 'Liberation Serif', label: 'Liberation Serif (Formal Serif)' },
  { value: 'Nimbus Roman', label: 'Nimbus Roman (Classic Times-style)' },
  { value: 'DejaVu Sans Mono', label: 'DejaVu Sans Mono (Monospace)' },
];

const ICON_TUNE = 'tune';
const ICON_VERTICAL_SPLIT = 'vertical_split';
const ICON_ALT_ROUTE = 'alt_route';
const ICON_DESCRIPTION = 'description';
const ICON_SEARCH = 'search';
const ICON_EDIT = 'edit';

function PdfTemplatesContent() {
  const t = useTranslations('admin.reporting');
  useDocumentTitle(t('title'));
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as 'branding' | 'templates' | 'hooks' | null;
  const [activeTab, setActiveTab] = useState<'branding' | 'templates' | 'hooks'>(tabParam || 'branding');

  useEffect(() => {
    if (tabParam && ['branding', 'templates', 'hooks'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'branding' | 'templates' | 'hooks') => {
    setActiveTab(tab);
    router.replace(`/admin/settings/pdf-templates?tab=${tab}`);
  };

  // ── Branding Tab State ──────────────────────────────────────────────────────
  const [orgSettings, setOrgSettings] = useState<api.OrganizationSettingsResponseDto | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#1e3a5f');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [mutedColor, setMutedColor] = useState('');
  const [fontFamily, setFontFamily] = useState('DejaVu Sans');
  const [customFont, setCustomFont] = useState('');
  const [baseFontSizePt, setBaseFontSizePt] = useState(10);

  // Fragments State
  const [templatesList, setTemplatesList] = useState<ReportTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [activeFragmentTab, setActiveFragmentTab] = useState<FragmentTab>('customer-header');
  const [fragmentCode, setFragmentCode] = useState('');
  const [savingFragment, setSavingFragment] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // ── Hooks Tab State ─────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hooksLoading, setHooksLoading] = useState(true);

  // Load All Data
  const loadData = useCallback(async () => {
    try {
      const [orgRes, reportsRes, assignRes] = await Promise.all([
        api.organizationControllerGet(),
        api.pdfTemplatesControllerGetAllReports(),
        api.pdfTemplatesControllerGetAssignments(),
      ]);

      if (orgRes.data) {
        setOrgSettings(orgRes.data);
        const cfg = orgRes.data.pdfThemeConfig;
        if (cfg) {
          if (cfg.primaryColor) setPrimaryColor(cfg.primaryColor);
          if (cfg.accentColor) setAccentColor(cfg.accentColor);
          if (cfg.mutedColor) setMutedColor(cfg.mutedColor);
          if (cfg.fontFamily) {
            setFontFamily(cfg.fontFamily);
            if (!PRESET_FONTS.some((f) => f.value === cfg.fontFamily)) {
              setCustomFont(cfg.fontFamily);
            }
          }
          if (cfg.baseFontSizePt) setBaseFontSizePt(cfg.baseFontSizePt);
        }
      }

      const allReports = (reportsRes.data || []) as ReportTemplate[];
      setTemplatesList(allReports);
      setAssignments(assignRes.data || []);
    } catch (e) {
      toast.error('Failed to load PDF configuration: ' + getErrorMessage(e));
    } finally {
      setHooksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync fragment code editor when selected tab changes
  const targetFragmentSlug = useMemo(() => {
    return `fragment-${activeFragmentTab}`;
  }, [activeFragmentTab]);

  const isCustomerFragment = activeFragmentTab.startsWith('customer');

  const activeFragmentTemplate = useMemo(() => {
    return templatesList.find((t) => t.slug === targetFragmentSlug);
  }, [templatesList, targetFragmentSlug]);

  useEffect(() => {
    if (activeFragmentTemplate) {
      setFragmentCode(activeFragmentTemplate.template);
    } else {
      setFragmentCode('');
    }
  }, [activeFragmentTemplate]);

  const fragmentTabs = useMemo<TabItem<FragmentTab>[]>(
    () => [
      { id: 'customer-header', label: t('branding.customerHeader') },
      { id: 'customer-footer', label: t('branding.customerFooter') },
      { id: 'supplier-header', label: t('branding.supplierHeader') },
      { id: 'supplier-footer', label: t('branding.supplierFooter') },
    ],
    [t],
  );

  // Auto-save Theme Configuration
  const saveThemeConfig = async (partialConfig: Partial<api.PdfThemeConfigDto>) => {
    if (!orgSettings) return;
    try {
      const newConfig: api.PdfThemeConfigDto = {
        primaryColor,
        accentColor,
        mutedColor: mutedColor.trim() ? mutedColor.trim() : undefined,
        fontFamily: customFont.trim() ? customFont.trim() : fontFamily,
        baseFontSizePt: Number(baseFontSizePt),
        ...partialConfig,
      };
      await api.organizationControllerUpdate({
        name: orgSettings.name || 'Organization',
        addressLine1: orgSettings.addressLine1,
        addressLine2: orgSettings.addressLine2,
        city: orgSettings.city,
        state: orgSettings.state,
        country: orgSettings.country,
        postCode: orgSettings.postCode,
        email: orgSettings.email,
        phone: orgSettings.phone,
        website: orgSettings.website,
        companyNumber: orgSettings.companyNumber,
        taxNumber: orgSettings.taxNumber,
        bankName: orgSettings.bankName,
        bankAccountName: orgSettings.bankAccountName,
        bankAccountNumber: orgSettings.bankAccountNumber,
        bankSwiftBic: orgSettings.bankSwiftBic,
        bankIban: orgSettings.bankIban,
        pdfThemeConfig: newConfig,
      });
      setOrgSettings((prev) => (prev ? { ...prev, pdfThemeConfig: newConfig } : null));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  // Save Current Header / Footer Fragment
  const handleSaveFragment = async () => {
    if (!activeFragmentTemplate) {
      toast.error(`Fragment ${targetFragmentSlug} not found in database.`);
      return;
    }
    setSavingFragment(true);
    try {
      await api.pdfTemplatesControllerUpdateReport(activeFragmentTemplate.id, {
        template: fragmentCode,
      });
      toast.success(`${targetFragmentSlug} updated successfully!`);
      loadData();
    } catch (e) {
      toast.error('Failed to save fragment: ' + getErrorMessage(e));
    } finally {
      setSavingFragment(false);
    }
  };

  // Generate Live PDF Preview
  const handlePreview = async (contextSlug: string) => {
    setPreviewing(true);
    try {
      let currentTemplates = templatesList;
      if (!currentTemplates || currentTemplates.length === 0) {
        const reportsRes = await api.pdfTemplatesControllerGetAllReports();
        currentTemplates = (reportsRes.data || []) as ReportTemplate[];
        setTemplatesList(currentTemplates);
      }

      const sampleTemplateSlug = contextSlug === 'sales-invoice' ? 'sales-invoice' : 'purchase-order';
      let tmpl = currentTemplates.find((t) => t.slug === sampleTemplateSlug);
      if (!tmpl) {
        tmpl = currentTemplates.find((t) => t.contexts && t.contexts.includes(contextSlug));
      }
      if (!tmpl) {
        tmpl = currentTemplates.find(
          (t) =>
            t.slug.includes(contextSlug) ||
            (t.contexts && t.contexts.some((c) => c.includes(contextSlug))),
        );
      }
      if (!tmpl && currentTemplates.length > 0) {
        tmpl = currentTemplates[0];
      }

      if (!tmpl) {
        throw new Error(`Template for ${sampleTemplateSlug} not found`);
      }

      const randomIdRes = await api.pdfTemplatesControllerGetRandomId(contextSlug).catch(() => ({
        data: { id: null },
      }));
      const entityId = randomIdRes.data?.id || undefined;

      const res = await api.pdfTemplatesControllerPreview({
        template: tmpl.template,
        mockData: {},
        hookSlug: contextSlug,
        entityId,
      });

      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
      toast.success('Preview rendered!');
    } catch (e) {
      toast.error('Failed to render preview: ' + getErrorMessage(e));
    } finally {
      setPreviewing(false);
    }
  };

  // ── Hook Assignment Save ────────────────────────────────────────────────────
  const handleHookSave = async (payload: Assignment) => {
    try {
      await api.pdfTemplatesControllerUpdateAssignment(payload.hookSlug, {
        reportId: payload.reportId || '',
        contextSlug: payload.contextSlug || '',
      });
      toast.success(t('hooks.toast.success'));
      loadData();
    } catch (e: unknown) {
      toast.error(t('hooks.errors.updateFailed') + getErrorMessage(e));
      throw e;
    }
  };

  const hookColumns: InlineTableColumn<Assignment>[] = useMemo(
    () => [
      {
        key: 'hookSlug',
        title: t('hooks.table.columns.hookSlug'),
        type: 'text',
        disabled: true,
        width: 250,
        render: (row) => <span className="font-mono text-xs">{row.hookSlug}</span>,
      },
      {
        key: 'contextSlug',
        title: t('hooks.table.columns.contextResolver'),
        type: 'text',
        disabled: true,
        width: 200,
        render: (row) => <span className="text-xs text-gray-500 italic">{row.contextSlug || '—'}</span>,
      },
      {
        key: 'reportId',
        title: t('hooks.table.columns.assignedTemplate'),
        type: 'select',
        options: (row) => {
          let available = templatesList;
          if (row.contextSlug) {
            available = templatesList.filter(
              (tmpl) => tmpl.contexts && tmpl.contexts.includes(row.contextSlug!),
            );
          }
          return available.map((tmpl) => ({ value: tmpl.id, label: tmpl.name }));
        },
        emptyLabel: t('hooks.table.selectTemplate'),
      },
      {
        key: 'actions',
        title: '',
        width: 150,
        render: (row, isEditing) => {
          if (isEditing || !row.reportId) return null;
          return (
            <div className="flex justify-start">
              <Link
                href={`/admin/settings/pdf-templates/${row.reportId}`}
                className="text-[11px] font-bold text-[#006b5c] hover:underline uppercase tracking-widest"
              >
                {t('hooks.actions.editTemplate')}
              </Link>
            </div>
          );
        },
      },
    ],
    [templatesList, t],
  );

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templatesList;
    const q = templateSearch.toLowerCase();
    return templatesList.filter((tmpl) =>
      tmpl.name.toLowerCase().includes(q) ||
      tmpl.slug.toLowerCase().includes(q) ||
      (tmpl.description && tmpl.description.toLowerCase().includes(q)) ||
      (tmpl.outputNamePattern && tmpl.outputNamePattern.toLowerCase().includes(q))
    );
  }, [templatesList, templateSearch]);

  const navSections = useMemo<PageSection[]>(
    () => [
      {
        id: 'tab-branding',
        label: t('tabs.branding'),
        isSubPage: true,
        isActive: activeTab === 'branding',
        onClick: () => handleTabChange('branding'),
        subtargets: [
          {
            id: 'theme-section',
            label: t('branding.title'),
            onClick: () => {
              handleTabChange('branding');
              setTimeout(() => document.getElementById('theme-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            },
          },
          {
            id: 'fragments-section',
            label: t('branding.standardLayouts'),
            onClick: () => {
              handleTabChange('branding');
              setTimeout(() => document.getElementById('fragments-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            },
          },
        ],
      },
      {
        id: 'tab-templates',
        label: t('tabs.templates'),
        isSubPage: true,
        isActive: activeTab === 'templates',
        onClick: () => handleTabChange('templates'),
      },
      {
        id: 'tab-hooks',
        label: t('tabs.hooks'),
        isSubPage: true,
        isActive: activeTab === 'hooks',
        onClick: () => handleTabChange('hooks'),
      },
    ],
    [activeTab, t],
  );

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader title={t('title')}>
        <PageNav sections={navSections} />
      </ContentPageHeader>

      <div className="flex flex-col gap-6">
        {/* ── Tab 1: Settings ────────────────────────────────────────────────── */}
        {activeTab === 'branding' && (
          <>
            {/* Card 1: Fonts & Colors */}
            <div id="theme-section" className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading flex items-center gap-2">
                  <span className="material-symbols-outlined">{ICON_TUNE}</span>
                  {t('branding.title')}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
                {/* Primary Color */}
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('branding.primaryColor')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        saveThemeConfig({ primaryColor: e.target.value });
                      }}
                      className="w-9 h-9 rounded cursor-pointer border border-[var(--border)] p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      onBlur={() => saveThemeConfig({ primaryColor })}
                      className="input font-mono text-xs w-full"
                      placeholder="#1e3a5f"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('branding.accentColor')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => {
                        setAccentColor(e.target.value);
                        saveThemeConfig({ accentColor: e.target.value });
                      }}
                      className="w-9 h-9 rounded cursor-pointer border border-[var(--border)] p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      onBlur={() => saveThemeConfig({ accentColor })}
                      className="input font-mono text-xs w-full"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>

                {/* Muted / Label Color */}
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    Muted / Label Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={mutedColor || '#64748b'}
                      onChange={(e) => {
                        setMutedColor(e.target.value);
                        saveThemeConfig({ mutedColor: e.target.value });
                      }}
                      className="w-9 h-9 rounded cursor-pointer border border-[var(--border)] p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={mutedColor}
                      onChange={(e) => setMutedColor(e.target.value)}
                      onBlur={() => saveThemeConfig({ mutedColor })}
                      className="input font-mono text-xs w-full"
                      placeholder="#64748b (Auto)"
                    />
                  </div>
                </div>

                {/* Font Family */}
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('branding.fontFamily')}
                  </label>
                  <select
                    value={PRESET_FONTS.some((f) => f.value === fontFamily) ? fontFamily : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'custom') {
                        setFontFamily(val);
                        setCustomFont('');
                        saveThemeConfig({ fontFamily: val });
                      } else {
                        setFontFamily('custom');
                      }
                    }}
                    className="input w-full text-xs"
                  >
                    {PRESET_FONTS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                    <option value="custom">{t('branding.customFontOption')}</option>
                  </select>
                  {fontFamily === 'custom' && (
                    <input
                      type="text"
                      value={customFont}
                      onChange={(e) => setCustomFont(e.target.value)}
                      onBlur={() => {
                        if (customFont.trim()) saveThemeConfig({ fontFamily: customFont.trim() });
                      }}
                      placeholder={t('branding.customFontPlaceholder')}
                      className="input w-full font-mono text-xs mt-2"
                    />
                  )}
                </div>

                {/* Base Font Size */}
                <div className="flex flex-col gap-1">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {t('branding.baseFontSize')}
                  </label>
                  <select
                    value={baseFontSizePt}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBaseFontSizePt(val);
                      saveThemeConfig({ baseFontSizePt: val });
                    }}
                    className="input w-full text-xs"
                  >
                    <option value={8}>8 pt (Compact)</option>
                    <option value={9}>9 pt (Standard Compact)</option>
                    <option value={10}>10 pt (Default)</option>
                    <option value={11}>11 pt (Readable)</option>
                    <option value={12}>12 pt (Large)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Modular Headers & Footers */}
            <div id="fragments-section" className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="section-heading flex items-center gap-2">
                  <span className="material-symbols-outlined">{ICON_VERTICAL_SPLIT}</span>
                  {t('branding.standardLayouts')}
                </h3>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handlePreview(isCustomerFragment ? 'sales-invoice' : 'purchase-order')}
                    disabled={previewing}
                  >
                    {previewing
                      ? t('branding.renderingPreview')
                      : isCustomerFragment
                        ? t('branding.previewInvoice')
                        : t('branding.previewPo')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveFragment}
                    disabled={savingFragment || !activeFragmentTemplate}
                  >
                    {savingFragment ? t('branding.savingFragment') : t('branding.saveFragment')}
                  </Button>
                </div>
              </div>

              {/* Standard Tabs for Customer & Supplier Header/Footer Fragments */}
              <div className="mb-4">
                <Tabs<FragmentTab>
                  tabs={fragmentTabs}
                  activeTab={activeFragmentTab}
                  onChange={setActiveFragmentTab}
                  size="sm"
                />
              </div>

              {/* Code Editor & Live Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className={pdfPreviewUrl ? 'lg:col-span-7' : 'lg:col-span-12'}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                      {`${targetFragmentSlug}.typ`}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {t('branding.fragmentTip')}
                    </span>
                  </div>
                  <textarea
                    value={fragmentCode}
                    onChange={(e) => setFragmentCode(e.target.value)}
                    rows={14}
                    className="input w-full font-mono text-xs leading-relaxed resize-y p-3"
                    placeholder="// Typst fragment code..."
                    spellCheck={false}
                  />
                </div>

                {pdfPreviewUrl && (
                  <div className="lg:col-span-5 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {t('branding.livePreview')}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setPdfPreviewUrl(null)}
                      >
                        {t('branding.closePreview')}
                      </Button>
                    </div>
                    <div className="flex-1 min-h-[350px] border border-[var(--border)] rounded-lg overflow-hidden">
                      <iframe
                        src={pdfPreviewUrl}
                        className="w-full h-full min-h-[350px] border-none"
                        title="PDF Preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Tab 2: Templates ────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div id="templates-section" className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="section-heading flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined">{ICON_DESCRIPTION}</span>
                  {t('tabs.templates')}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none select-none">
                    {ICON_SEARCH}
                  </span>
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder={t('grid.searchPlaceholder')}
                    className="w-64 !pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <Button asChild variant="primary" size="sm">
                  <Link href="/admin/settings/pdf-templates/new">
                    {t('grid.createButton')}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table-lines w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider py-3 px-4">
                      {t('grid.columns.templateName')}
                    </th>
                    <th className="text-left font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider py-3 px-4">
                      {t('grid.columns.systemToken')}
                    </th>
                    <th className="text-left font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider py-3 px-4">
                      {t('grid.columns.description')}
                    </th>
                    <th className="text-left font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider py-3 px-4">
                      {t('grid.columns.outputFilename')}
                    </th>
                    <th className="text-right py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[var(--text-muted)]">
                        {t('hooks.table.empty')}
                      </td>
                    </tr>
                  ) : (
                    filteredTemplates.map((tmpl) => (
                      <tr key={tmpl.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                          <Link
                            href={`/admin/settings/pdf-templates/${tmpl.id}`}
                            className="hover:text-[#006b5c] hover:underline font-semibold"
                          >
                            {tmpl.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {tmpl.slug}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {tmpl.description || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {tmpl.outputNamePattern || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end">
                            <Button
                              asChild
                              variant="secondary"
                              size="xs"
                              className="flex items-center justify-center w-7 h-7 p-0"
                              title={t('hooks.actions.editTemplate')}
                            >
                              <Link href={`/admin/settings/pdf-templates/${tmpl.id}`}>
                                <span className="material-symbols-outlined text-[16px]">{ICON_EDIT}</span>
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab 3: Hook Assignments ─────────────────────────────────────────── */}
        {activeTab === 'hooks' && (
          <div id="hooks-section" className="card">
            <h3 className="section-heading flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined">{ICON_ALT_ROUTE}</span>
              {t('hooks.title')}
            </h3>
            <InlineSettingsTable
              title=""
              columns={hookColumns}
              data={assignments}
              rowKey={(row) => row.hookSlug}
              onSave={handleHookSave}
              emptyLabel={hooksLoading ? null : t('hooks.table.empty')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--text-muted)]">Loading PDF Templates...</div>}>
      <PdfTemplatesContent />
    </Suspense>
  );
}


