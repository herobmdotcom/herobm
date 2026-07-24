import React from 'react';
import Link from 'next/link';
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
      {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
      <span className="material-symbols-outlined text-gray-400 mt-0.5">folder</span>
      
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900">{project.name}</span>
        </div>
        
        <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
          <span className="capitalize">Type: {project.type.replace('_', ' ')}</span>
          <span className="text-gray-300">&bull;</span>
          <span className="capitalize">Status: {project.status.replace('_', ' ')}</span>
          <span className="text-gray-300">&bull;</span>
          <span>Created: {new Date(project.createdOn).toLocaleDateString()}</span>
          <span className="text-gray-300">&bull;</span>
          <span>Modified: {new Date(project.modifiedOn).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
}
