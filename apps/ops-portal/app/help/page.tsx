'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { customFetch } from '@herobm/sdk';
import { HelpTopicSummary, HelpTopic } from '@/components/help/HelpTypes';
import { MarkdownRenderer } from '@/components/help/MarkdownRenderer';
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';

function HelpContent() {
  const t = useTranslations('help');
  const searchParams = useSearchParams();
  const router = useRouter();

  const [topics, setTopics] = useState<HelpTopicSummary[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [topicDetail, setTopicDetail] = useState<HelpTopic | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTopics() {
      try {
        const res = await customFetch<{ data: HelpTopicSummary[] }>('/help/topics', {
          method: 'GET',
        });
        const list = res?.data ?? [];
        setTopics(list);

        const paramTopic = searchParams.get('topic');
        if (paramTopic) {
          setActiveTopicId(paramTopic);
        } else if (list.length > 0) {
          setActiveTopicId(list[0].id);
        }
      } catch {
        setTopics([]);
        toast.error('Failed to load help topics');
      } finally {
        setIsLoading(false);
      }
    }

    loadTopics();
  }, [searchParams]);

  useEffect(() => {
    if (!activeTopicId) return;

    async function loadDetail(id: string) {
      try {
        setIsLoading(true);
        const res = await customFetch<{ data: HelpTopic }>(
          `/help/topics/${encodeURIComponent(id)}`,
          { method: 'GET' },
        );
        setTopicDetail(res?.data ?? null);
      } catch {
        setTopicDetail(null);
        toast.error('Failed to load topic details');
      } finally {
        setIsLoading(false);
      }
    }

    loadDetail(activeTopicId);
  }, [activeTopicId]);

  const selectTopic = (id: string) => {
    setActiveTopicId(id);
    router.replace(`/help?topic=${encodeURIComponent(id)}`);
  };

  const filteredTopics = topics.filter((topicItem) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      topicItem.title.toLowerCase().includes(q) ||
      topicItem.category.toLowerCase().includes(q) ||
      topicItem.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const categoriesMap: Record<string, HelpTopicSummary[]> = {};
  filteredTopics.forEach((topicItem) => {
    const cat = topicItem.category || 'General';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(topicItem);
  });

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] bg-[var(--bg-primary)] overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-80 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-glow)] text-[var(--accent)] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
            </div>
            <h1 className="text-sm font-bold text-[var(--text-primary)]">
              {t('manual')}
            </h1>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-muted)] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={t('filterTopics')}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {Object.entries(categoriesMap).map(([category, items]) => (
            <div key={category} className="space-y-1">
              <h2 className="px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {category}
              </h2>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => selectTopic(item.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer !border-0 ${
                      activeTopicId === item.id
                        ? 'bg-[var(--accent)] text-white font-semibold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="truncate flex-1 text-left">{item.title}</span>
                    <span className="material-symbols-outlined text-[14px] opacity-70">
                      chevron_right
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl">
        {isLoading && !topicDetail ? (
          <div className="py-20 text-center text-xs text-[var(--text-muted)]">
            {t('loadingDocs')}
          </div>
        ) : topicDetail ? (
          <div className="space-y-6">
            <div className="border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]/30">
                  {topicDetail.category}
                </span>
                {topicDetail.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {topicDetail.title}
              </h1>
              {topicDetail.description && (
                <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
                  {topicDetail.description}
                </p>
              )}
            </div>

            {/* Field Guide Section */}
            {topicDetail.fields && Object.keys(topicDetail.fields).length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">
                    table_view
                  </span>
                  {t('fieldGuide')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {Object.entries(topicDetail.fields).map(([k, val]) => {
                    const title = typeof val === 'object' && val.title ? val.title : k;
                    const summary = typeof val === 'object' ? val.summary : String(val);
                    return (
                      <div
                        key={k}
                        className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {title}
                          </span>
                          <code className="text-[10px] px-1 py-0.2 rounded bg-[var(--bg-secondary)] text-[var(--accent)] font-mono">
                            {k}
                          </code>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-normal">
                          {summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Markdown Content */}
            <MarkdownRenderer content={topicDetail.content} />
          </div>
        ) : (
          <div className="py-20 text-center text-xs text-[var(--text-muted)]">
            {t('selectTopicPrompt')}
          </div>
        )}
      </main>
    </div>
  );
}

export default function HelpPage() {
  const t = useTranslations('help');
  return (
    <Suspense fallback={<div className="p-8 text-xs text-[var(--text-muted)]">{t('loadingDocs')}</div>}>
      <HelpContent />
    </Suspense>
  );
}
