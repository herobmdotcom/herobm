import React from 'react';
import Link from 'next/link';
import { formatLocalDate } from '@/lib/date';
import type { ProjectResponseDto } from '@herobm/sdk';

interface ProjectCardProps {
  project: ProjectResponseDto;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/crm/projects/${project.projectId}`}
      className="p-4 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] flex items-start gap-3 w-full hover:border-[var(--accent)] hover:shadow-sm transition-all cursor-pointer block"
    >

      <span className="material-symbols-outlined text-[var(--text-muted)] mt-0.5">folder</span>
      
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[var(--text-primary)]">{project.name}</span>
        </div>
        
        <div className="text-sm text-[var(--text-muted)] flex flex-wrap items-center gap-2">
          <span className="capitalize">Type: {project.type.replace('_', ' ')}</span>
          <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
          <span className="capitalize">Status: {project.status.replace('_', ' ')}</span>
          <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
          <span>Created: {formatLocalDate(project.createdOn)}</span>
          <span className="text-[var(--text-muted)] opacity-50">&bull;</span>
          <span>Modified: {formatLocalDate(project.modifiedOn)}</span>
        </div>
      </div>
    </Link>
  );
}
