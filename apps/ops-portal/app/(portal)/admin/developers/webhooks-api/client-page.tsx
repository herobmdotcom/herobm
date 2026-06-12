'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRouter } from 'next/navigation';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

interface Props {
  title: string;
  subtitle: string;
  html: string;
}

export default function WebhooksClientPage({ title, subtitle, html }: Props) {
  useDocumentTitle(title);
  const router = useRouter();

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={title}
          subtitle={subtitle}
          onBack={() => router.push('/admin/developers')}
          showPrint={false}
        />
      }
    >
      <div className="card pb-12">
        <div 
          className="text-sm text-[var(--text-secondary)] space-y-4
          [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-[var(--brand-navy)] [&_h1]:mb-4
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--brand-navy)] [&_h2]:mt-8 [&_h2]:mb-3
          [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-[var(--brand-navy)] [&_h3]:mt-6 [&_h3]:mb-2
          [&_h4]:text-base [&_h4]:font-medium [&_h4]:text-[var(--brand-navy)] [&_h4]:mt-4 [&_h4]:mb-2
          [&_p]:mb-4 [&_p]:leading-relaxed
          [&_a]:text-[var(--accent)] [&_a]:no-underline hover:[&_a]:underline
          [&_code]:text-[var(--brand-navy)] [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs
          [&_pre]:bg-[#f7f9fb] [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:overflow-x-auto [&_pre]:mt-2 [&_pre]:mb-4
          [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-[var(--brand-navy)]
          [&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-5 [&_ul]:space-y-1.5 [&_ul]:mb-4
          [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:ml-5 [&_ol]:space-y-1.5 [&_ol]:mb-4
          [&_li]:pl-1
          [&_table]:w-full [&_table]:border-collapse [&_table]:mb-6 [&_table]:border [&_table]:border-[var(--border)] [&_table]:rounded-md [&_table]:overflow-hidden
          [&_th]:bg-[#f7f9fb] [&_th]:border-b [&_th]:border-[var(--border)] [&_th]:p-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-[var(--brand-navy)]
          [&_td]:border-b [&_td]:border-[var(--border)] [&_td]:p-3 [&_td]:text-xs
          [&_tr:last-child_td]:border-0
          [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--border)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--text-muted)]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </DetailsLayout>
  );
}
