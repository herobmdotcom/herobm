'use client';

import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return '';

    const md = new MarkdownIt({
      html: true,
      linkify: true,
      breaks: false,
    });

    // Custom rule or regex preprocessing for alerts
    let preprocessed = content;

    // Convert github alerts > [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP]
    preprocessed = preprocessed.replace(
      />\s*\[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION)\]\s*\n((?:>.*(?:\n|$))*)/gi,
      (match, type, body) => {
        const cleanBody = body
          .split('\n')
          .map((l: string) => l.replace(/^>\s?/, ''))
          .join('\n')
          .trim();

        const typeLower = type.toLowerCase();
        let borderClass = 'border-[var(--accent)] bg-[var(--accent-glow)] text-[var(--text-primary)]';
        let icon = 'info';

        if (typeLower === 'important' || typeLower === 'warning' || typeLower === 'caution') {
          borderClass = 'border-amber-500 bg-amber-500/10 text-amber-200';
          icon = 'warning';
        } else if (typeLower === 'tip') {
          borderClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-200';
          icon = 'lightbulb';
        }

        return `\n\n<div class="my-3 p-3 rounded-lg border-l-4 ${borderClass} text-xs leading-relaxed">
<div class="font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5 opacity-90">
  <span class="material-symbols-outlined text-[14px]">${icon}</span> ${type}
</div>
${cleanBody}
</div>\n\n`;
      },
    );

    // Strip raw mermaid code fences or render them nicely as diagrams / preformatted
    preprocessed = preprocessed.replace(
      /```mermaid\n([\s\S]*?)```/g,
      (match, code) => {
        return `\n<div class="my-3 p-3 rounded bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-muted)] overflow-x-auto whitespace-pre"><div class="text-[10px] uppercase font-bold text-[var(--text-primary)] mb-1">Diagram</div>${code.trim()}</div>\n`;
      },
    );

    return md.render(preprocessed);
  }, [content]);

  return (
    <div
      className={`prose prose-invert max-w-none text-sm text-[var(--text-secondary)] leading-relaxed
        [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-[var(--text-primary)] [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:tracking-tight
        [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-[var(--text-primary)] [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:pb-1 [&>h2]:border-b [&>h2]:border-[var(--border)]
        [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-[var(--text-primary)] [&>h3]:mt-4 [&>h3]:mb-1.5
        [&>p]:my-2.5 [&>p]:leading-normal
        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ul>li]:my-1
        [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>ol>li]:my-1
        [&>hr]:my-4 [&>hr]:border-[var(--border)]
        [&>table]:w-full [&>table]:my-3 [&>table]:border-collapse [&>table]:border [&>table]:border-[var(--border)] [&>table]:rounded-lg [&>table]:overflow-hidden [&>table]:text-xs
        [&>table_th]:bg-[var(--bg-secondary)] [&>table_th]:text-[var(--text-primary)] [&>table_th]:font-semibold [&>table_th]:p-2 [&>table_th]:border [&>table_th]:border-[var(--border)] [&>table_th]:text-left
        [&>table_td]:p-2 [&>table_td]:border [&>table_td]:border-[var(--border)] [&>table_td]:text-[var(--text-secondary)]
        [&>table_tr:nth-child(even)]:bg-[var(--bg-secondary)]/30
        [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--border)] [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:italic [&>blockquote]:text-[var(--text-muted)]
        [&>pre]:bg-[var(--bg-secondary)] [&>pre]:border [&>pre]:border-[var(--border)] [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:my-3
        [&>pre>code]:bg-transparent [&>pre>code]:text-xs [&>pre>code]:text-[var(--accent)] [&>pre>code]:font-mono
        [&_code:not(pre_code)]:bg-[var(--bg-secondary)] [&_code:not(pre_code)]:text-[var(--accent)] [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:text-xs [&_code:not(pre_code)]:font-mono
        ${className}
      `}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
