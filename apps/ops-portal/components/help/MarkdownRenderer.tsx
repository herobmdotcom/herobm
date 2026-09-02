'use client';

import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface ContentChunk {
  type: 'markdown' | 'mermaid';
  content: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const chunks = useMemo<ContentChunk[]>(() => {
    if (!content) return [];

    const parts: ContentChunk[] = [];
    const regex = /```mermaid\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'markdown',
          content: content.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'mermaid',
        content: match[1],
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'markdown',
        content: content.substring(lastIndex),
      });
    }

    return parts;
  }, [content]);

  const md = useMemo(() => {
    const instance = new MarkdownIt({
      html: true,
      linkify: true,
      breaks: false,
    });

    const defaultRender =
      instance.renderer.rules.link_open ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
      };

    instance.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const hrefIndex = tokens[idx].attrIndex('href');
      const attrs = tokens[idx].attrs;
      if (hrefIndex >= 0 && attrs && attrs[hrefIndex]) {
        const href = attrs[hrefIndex][1];
        if (/^https?:\/\//i.test(href)) {
          tokens[idx].attrPush(['target', '_blank']);
          tokens[idx].attrPush(['rel', 'noopener noreferrer']);
        } else if (href.endsWith('.md')) {
          const cleanName = href.replace(/^(\.\/|\.\.\/)+/, '').replace(/\.md$/, '');
          const topicMap: Record<string, string> = {
            admin_groups_settings: 'admin-settings',
            admin_users_roles: 'admin-users',
            dynamic_reporting: 'reporting',
            inventory_management: 'inventory',
            purchase_order_management: 'purchase-orders',
            purchase_returns_debit_notes: 'purchase-returns',
            sales_order_management: 'sales-orders',
          };
          const topicId = topicMap[cleanName] || cleanName.replace(/_/g, '-');
          attrs[hrefIndex][1] = `/help?topic=${encodeURIComponent(topicId)}`;
        }
      }
      return defaultRender(tokens, idx, options, env, self);
    };

    return instance;
  }, []);

  return (
    <div className={`space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed select-text font-sans ${className}`}>
      {chunks.map((chunk, index) => {
        if (chunk.type === 'mermaid') {
          return <MermaidDiagram key={index} chart={chunk.content} />;
        }

        // Normalize CRLF to LF for consistent regex parsing across platforms
        const normalized = chunk.content.replace(/\r\n/g, '\n');

        // Pre-process GitHub alerts with nested markdown parsing
        const preprocessed = normalized.replace(
          /^[ \t]*>[ \t]*\[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION|INFO|DANGER)\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/gim,
          (match, type, body) => {
            const cleanBody = body
              .split('\n')
              .map((l: string) => l.replace(/^[ \t]*>[ \t]?/, ''))
              .join('\n')
              .trim();

            const innerHtml = md.render(cleanBody);
            const typeUpper = (type as string).toUpperCase();

            let borderClass = 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--text-primary)]';
            let icon = 'info';
            let badgeClass = 'text-[var(--accent)]';

            if (typeUpper === 'IMPORTANT' || typeUpper === 'WARNING' || typeUpper === 'CAUTION') {
              borderClass = 'border-amber-500/40 bg-amber-500/10 text-[var(--text-primary)]';
              icon = 'warning';
              badgeClass = 'text-amber-500 dark:text-amber-400';
            } else if (typeUpper === 'DANGER') {
              borderClass = 'border-red-500/40 bg-red-500/10 text-[var(--text-primary)]';
              icon = 'error';
              badgeClass = 'text-red-500 dark:text-red-400';
            } else if (typeUpper === 'TIP') {
              borderClass = 'border-emerald-500/40 bg-emerald-500/10 text-[var(--text-primary)]';
              icon = 'lightbulb';
              badgeClass = 'text-emerald-600 dark:text-emerald-400';
            }

            return `\n\n<div class="my-4 p-3.5 rounded-xl border ${borderClass} text-xs leading-relaxed not-italic">
  <div class="font-bold uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5 ${badgeClass}">
    <span class="material-symbols-outlined text-[16px]">${icon}</span> ${typeUpper}
  </div>
  <div class="space-y-1.5 [&>p]:my-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul>li]:my-0.5 [&>ol]:list-decimal [&>ol]:pl-4 [&_code]:bg-[var(--bg-secondary)] [&_code]:text-[var(--accent)] [&_code]:border [&_code]:border-[var(--border)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_strong]:font-bold [&_strong]:text-[var(--text-primary)] [&_a]:font-semibold [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80">
    ${innerHtml}
  </div>
</div>\n\n`;
          },
        );

        const html = md.render(preprocessed);

        return (
          <div
            key={index}
            className="prose max-w-none text-sm text-[var(--text-secondary)] leading-relaxed
              [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-[var(--text-primary)] [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:tracking-tight
              [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-[var(--text-primary)] [&>h2]:mt-6 [&>h2]:mb-2.5 [&>h2]:pb-1.5 [&>h2]:border-b [&>h2]:border-[var(--border)]
              [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-[var(--text-primary)] [&>h3]:mt-4 [&>h3]:mb-1.5
              [&>h4]:text-xs [&>h4]:font-semibold [&>h4]:text-[var(--text-secondary)] [&>h4]:mt-3 [&>h4]:mb-1
              [&>p]:my-2.5 [&>p]:leading-relaxed [&>p]:text-[var(--text-secondary)]
              [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ul]:space-y-1 [&>ul>li]:text-[var(--text-secondary)]
              [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>ol]:space-y-1 [&>ol>li]:text-[var(--text-secondary)]
              [&>hr]:my-5 [&>hr]:border-[var(--border)]
              [&>table]:w-full [&>table]:my-4 [&>table]:border-collapse [&>table]:border [&>table]:border-[var(--border)] [&>table]:rounded-xl [&>table]:overflow-hidden [&>table]:text-xs [&>table]:shadow-xs
              [&>table_th]:bg-[var(--bg-secondary)] [&>table_th]:text-[var(--text-primary)] [&>table_th]:font-bold [&>table_th]:p-2.5 [&>table_th]:border [&>table_th]:border-[var(--border)] [&>table_th]:text-left
              [&>table_td]:p-2.5 [&>table_td]:border [&>table_td]:border-[var(--border)] [&>table_td]:text-[var(--text-secondary)]
              [&>table_tr:nth-child(even)]:bg-[var(--bg-secondary)]/40
              [&>blockquote]:border-l-4 [&>blockquote]:border-[var(--accent)]/40 [&>blockquote]:bg-[var(--bg-secondary)]/30 [&>blockquote]:p-3 [&>blockquote]:rounded-r-lg [&>blockquote]:pl-3.5 [&>blockquote]:my-3 [&>blockquote]:italic [&>blockquote]:text-[var(--text-muted)]
              [&>pre]:bg-[var(--bg-card)] [&>pre]:border [&>pre]:border-[var(--border)] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:overflow-x-auto [&>pre]:my-3.5 [&>pre]:text-[var(--text-primary)]
              [&>pre>code]:bg-transparent [&>pre>code]:text-xs [&>pre>code]:text-[var(--text-primary)] [&>pre>code]:font-mono [&>pre>code]:leading-relaxed
              [&_code:not(pre_code)]:bg-[var(--bg-secondary)] [&_code:not(pre_code)]:text-[var(--accent)] [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:text-xs [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:font-medium [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-[var(--border)]
              [&_strong]:text-[var(--text-primary)] [&_strong]:font-semibold
              [&_a]:text-[var(--accent)] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-[var(--accent)]/40 hover:[&_a]:decoration-[var(--accent)] hover:[&_a]:opacity-90 [&_a]:transition-all
            "
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
