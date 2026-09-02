'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useHelp } from './HelpContext';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Button } from '@/components/shared/Button';

function getFieldDetails(fieldKey: string, val: unknown) {
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    return {
      title: obj.title ? String(obj.title) : fieldKey,
      summary: obj.summary ? String(obj.summary) : '',
    };
  }
  return {
    title: fieldKey,
    summary: String(val ?? ''),
  };
}

export function HelpDrawer() {
  const t = useTranslations('help');
  const {
    isOpen,
    closeHelp,
    activeTab,
    setActiveTab,
    contextTopic,
    activeTopic,
    relatedTopics,
    topics,
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    selectTopic,
    navigateBackToContext,
  } = useHelp();

  const [isFieldsExpanded, setIsFieldsExpanded] = useState(true);

  if (!isOpen) return null;

  const CATEGORY_ORDER = [
    'Overview',
    'Dashboard',
    'Sales',
    'Inventory',
    'Purchasing',
    'Manufacturing',
    'CRM',
    'Finance',
    'Reporting',
    'Administration',
    'Developer',
    'Architecture & Engineering',
    'Miscellaneous',
  ];

  // Group topics by category for the TOC view
  const categoriesMap: Record<string, typeof topics> = {};
  topics.forEach((topic) => {
    const cat = topic.category ? topic.category : 'Miscellaneous';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(topic);
  });

  const sortedCategoryEntries = Object.entries(categoriesMap).sort(([a], [b]) => {
    const idxA = CATEGORY_ORDER.indexOf(a);
    const idxB = CATEGORY_ORDER.indexOf(b);
    const orderA = idxA !== -1 ? idxA : 99;
    const orderB = idxB !== -1 ? idxB : 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  const isViewingSubTopic = Boolean(activeTopic && contextTopic && activeTopic.id !== contextTopic.id);
  const activeCategory = activeTopic?.category ? activeTopic.category : 'General';
  const expandIcon = isFieldsExpanded ? 'expand_less' : 'expand_more';

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden" role="dialog" aria-modal="true" aria-label={t('title')}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={closeHelp}
        aria-hidden="true"
      />

      {/* Slide-Over Container */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl justify-end pointer-events-none sm:pl-10">
        <aside
          className="pointer-events-auto w-full bg-[var(--bg-card)] text-[var(--text-primary)] border-l border-[var(--border)] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 ease-out"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">
                    menu_book
                  </span>
                </div>
                <div>
                  <h2 className="font-bold text-base text-[var(--text-primary)] tracking-tight">
                    {t('manual')}
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {t('shortcut')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href="/help"
                  onClick={closeHelp}
                  className="px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded-md border border-[var(--border)] transition-colors flex items-center gap-1 no-underline"
                  title={t('fullManual')}
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>{t('fullManual')}</span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] cursor-pointer !p-0"
                  onClick={closeHelp}
                  aria-label={t('back')}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-card)] rounded-lg border border-[var(--border)]">
              <Button
                type="button"
                variant={activeTab === 'context' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('context')}
                className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-none"
              >
                <span className="material-symbols-outlined text-[16px]">auto_stories</span>
                <span>{t('contextTab')}</span>
              </Button>

              <Button
                type="button"
                variant={activeTab === 'toc' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('toc')}
                className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-none"
              >
                <span className="material-symbols-outlined text-[16px]">list_alt</span>
                <span>{t('tocTab')}</span>
              </Button>

              <Button
                type="button"
                variant={activeTab === 'search' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('search')}
                className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-none"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span>{t('searchTab')}</span>
              </Button>
            </div>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {isLoading && (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)] gap-2">
                <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                <span className="text-xs">{t('loadingDocs')}</span>
              </div>
            )}

            {!isLoading && activeTab === 'context' && (
              <div>
                {isViewingSubTopic && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={navigateBackToContext}
                    className="mb-4 text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent !border-0 p-0 shadow-none"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>{t('backToScreen')}</span>
                  </Button>
                )}

                {activeTopic ? (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="border-b border-[var(--border)] pb-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]/30">
                          {activeCategory}
                        </span>
                        {activeTopic.tags && activeTopic.tags.length > 0 && (
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {activeTopic.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                        {activeTopic.title}
                      </h1>
                      {activeTopic.description && (
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                          {activeTopic.description}
                        </p>
                      )}
                    </div>

                    {/* Field Reference Guide (Structured UI Reference) */}
                    {activeTopic.fields && Object.keys(activeTopic.fields).length > 0 && (
                      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsFieldsExpanded(!isFieldsExpanded)}
                          className="w-full px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary-hover)] flex items-center justify-between transition-colors cursor-pointer !border-0 text-left rounded-none shadow-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                              table_view
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                              {t('fieldGuide')} ({Object.keys(activeTopic.fields).length})
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)]">
                            {expandIcon}
                          </span>
                        </Button>

                        {isFieldsExpanded && (
                          <div className="p-3 border-t border-[var(--border)] grid grid-cols-1 gap-2 bg-[var(--bg-card)]">
                            {Object.entries(activeTopic.fields).map(([fieldKey, val]) => {
                              const details = getFieldDetails(fieldKey, val);
                              return (
                                <div
                                  key={fieldKey}
                                  className="p-2.5 rounded-lg bg-[var(--bg-secondary)]/70 border border-[var(--border)]"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                                      {details.title}
                                    </span>
                                    <code className="text-[10px] px-1 py-0.2 rounded bg-[var(--bg-card)] text-[var(--accent)] font-mono">
                                      {fieldKey}
                                    </code>
                                  </div>
                                  <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                                    {details.summary}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown Body Guide */}
                    <div className="pt-2">
                      <MarkdownRenderer content={activeTopic.content} />
                    </div>

                    {/* Related Topics Footer */}
                    {relatedTopics && relatedTopics.length > 0 && (
                      <div className="border-t border-[var(--border)] pt-4 mt-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">dataset_linked</span>
                          {t('relatedTopics')}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {relatedTopics.map((rel) => (
                            <Button
                              key={rel.id}
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => selectTopic(rel.id)}
                              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] hover:bg-[var(--accent)]/10 border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-primary)] hover:text-[var(--accent)] flex items-center gap-1.5 transition-colors cursor-pointer group shadow-none"
                            >
                              <span className="text-[10px] text-[var(--accent)] font-semibold">[{rel.category}]</span>
                              <span className="font-medium">{rel.title}</span>
                              <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">chevron_right</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 px-4 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] flex items-center justify-center mx-auto border border-[var(--border)]">
                      <span className="material-symbols-outlined text-[28px]">search_off</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {t('noContextTitle')}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                        {t('noContextDesc')}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('toc')}
                      className="mt-2"
                    >
                      <span>{t('allTopics')}</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!isLoading && activeTab === 'toc' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('categories')}
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {topics.length} {t('topicsAvailable')}
                  </span>
                </div>

                {sortedCategoryEntries.map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-extrabold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">folder</span>
                      {category}
                    </h4>

                    <div className="grid grid-cols-1 gap-2">
                      {items.map((item) => (
                        <Button
                          key={item.id}
                          type="button"
                          variant="ghost"
                          onClick={() => selectTopic(item.id)}
                          className="w-full text-left p-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--accent)]/10 border border-[var(--border)] hover:border-[var(--accent)] transition-all flex items-start justify-between gap-3 group cursor-pointer shadow-none !h-auto"
                        >
                          <div className="space-y-1 text-left flex-1">
                            <h5 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                              {item.title}
                            </h5>
                            {item.description && (
                              <p className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] line-clamp-2 leading-relaxed font-normal">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5">
                            chevron_right
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && activeTab === 'search' && (
              <div className="space-y-4">
                {/* Search Input Box */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                    autoFocus
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent !border-0 p-1 w-6 h-6 shadow-none"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Button>
                  )}
                </div>

                {/* Search Results */}
                {searchQuery.trim() ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {searchResults.length} {t('matches')}
                    </p>

                    {searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <Button
                          key={result.id}
                          type="button"
                          variant="ghost"
                          onClick={() => selectTopic(result.id)}
                          className="w-full text-left p-3 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--accent)]/10 border border-[var(--border)] hover:border-[var(--accent)] transition-all space-y-1.5 group cursor-pointer shadow-none !h-auto flex flex-col items-start"
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                              {result.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--bg-secondary)] group-hover:bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border)] group-hover:border-[var(--accent)]/30">
                              {result.category}
                            </span>
                          </div>
                          {result.snippet && (
                            <p className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] line-clamp-2 leading-relaxed font-normal text-left">
                              {result.snippet}
                            </p>
                          )}
                        </Button>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                        {t('emptySearch')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                    <p>{t('searchPrompt')}</p>
                    <p className="text-[10px]">{t('searchPromptSub')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
