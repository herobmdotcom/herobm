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
    return new MarkdownIt({
      html: true,
      linkify: true,
      breaks: false,
    });
  }, []);

  return (
    <div className={`space-y-4 text-sm text-[#334155] leading-relaxed select-text font-sans ${className}`}>
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

            let borderClass = 'border-[#99F6E4] bg-[#F0FDFA] text-[#134E48]';
            let icon = 'info';
            let badgeClass = 'text-[#0F766E]';

            if (typeUpper === 'IMPORTANT' || typeUpper === 'WARNING' || typeUpper === 'CAUTION' || typeUpper === 'DANGER') {
              borderClass = typeUpper === 'DANGER'
                ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#881337]'
                : 'border-[#FDE68A] bg-[#FEFCE8] text-[#713F12]';
              icon = typeUpper === 'DANGER' ? 'error' : 'warning';
              badgeClass = typeUpper === 'DANGER' ? 'text-[#BE123C]' : 'text-[#854D0E]';
            } else if (typeUpper === 'TIP') {
              borderClass = 'border-[#BBF7D0] bg-[#F0FDF4] text-[#14532D]';
              icon = 'lightbulb';
              badgeClass = 'text-[#15803D]';
            }

            return `\n\n<div class="my-4 p-3.5 rounded-xl border ${borderClass} text-xs leading-relaxed not-italic">
  <div class="font-bold uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5 ${badgeClass}">
    <span class="material-symbols-outlined text-[16px]">${icon}</span> ${typeUpper}
  </div>
  <div class="space-y-1.5 [&>p]:my-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul>li]:my-0.5 [&>ol]:list-decimal [&>ol]:pl-4 [&_code]:bg-black/5 [&_code]:text-[#0F172A] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_strong]:font-bold [&_strong]:text-[#0F172A]">
    ${innerHtml}
  </div>
</div>\n\n`;
          },
        );

        const html = md.render(preprocessed);

        return (
          <div
            key={index}
            className="prose max-w-none text-sm text-[#334155] leading-relaxed
              [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-[#0F172A] [&>h1]:mt-6 [&>h1]:mb-3 [&>h1]:tracking-tight
              [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-[#0F172A] [&>h2]:mt-6 [&>h2]:mb-2.5 [&>h2]:pb-1.5 [&>h2]:border-b [&>h2]:border-[#E2E8F0]
              [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-[#0F172A] [&>h3]:mt-4 [&>h3]:mb-1.5
              [&>h4]:text-xs [&>h4]:font-semibold [&>h4]:text-[#475569] [&>h4]:mt-3 [&>h4]:mb-1
              [&>p]:my-2.5 [&>p]:leading-relaxed [&>p]:text-[#334155]
              [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ul]:space-y-1 [&>ul>li]:text-[#334155]
              [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>ol]:space-y-1 [&>ol>li]:text-[#334155]
              [&>hr]:my-5 [&>hr]:border-[#E2E8F0]
              [&>table]:w-full [&>table]:my-4 [&>table]:border-collapse [&>table]:border [&>table]:border-[#CBD5E1] [&>table]:rounded-xl [&>table]:overflow-hidden [&>table]:text-xs [&>table]:shadow-xs
              [&>table_th]:bg-[#F8FAFC] [&>table_th]:text-[#0F172A] [&>table_th]:font-bold [&>table_th]:p-2.5 [&>table_th]:border [&>table_th]:border-[#CBD5E1] [&>table_th]:text-left
              [&>table_td]:p-2.5 [&>table_td]:border [&>table_td]:border-[#CBD5E1] [&>table_td]:text-[#334155]
              [&>table_tr:nth-child(even)]:bg-[#F8FAFC]/50
              [&>blockquote]:border-l-4 [&>blockquote]:border-[#CBD5E1] [&>blockquote]:pl-3.5 [&>blockquote]:my-3 [&>blockquote]:italic [&>blockquote]:text-[#64748B]
              [&>pre]:bg-[#F8FAFC] [&>pre]:border [&>pre]:border-[#CBD5E1] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:overflow-x-auto [&>pre]:my-3.5 [&>pre]:text-[#0F172A]
              [&>pre>code]:bg-transparent [&>pre>code]:text-xs [&>pre>code]:text-[#0F172A] [&>pre>code]:font-mono [&>pre>code]:leading-relaxed
              [&_code:not(pre_code)]:bg-[#F1F5F9] [&_code:not(pre_code)]:text-[#006B5C] [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:text-xs [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:font-medium [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-[#E2E8F0]
              [&_strong]:text-[#0F172A] [&_strong]:font-semibold
            "
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
