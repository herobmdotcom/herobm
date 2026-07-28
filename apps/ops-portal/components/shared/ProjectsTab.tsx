'use client';

import React, { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { reportError } from '@/lib/api';
import { ProjectCard } from './ProjectCard';

interface ProjectsTabProps {
  entityId: string;
  entityType: 'actor' | 'contact';
}

export function ProjectsTab({ entityId, entityType }: ProjectsTabProps) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<api.ProjectResponseDto[]>([]);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const res = await api.projectsControllerFindAll();
        if (res?.data?.data) {
          const filtered = res.data.data.filter(p => {
            if (entityType === 'actor') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Used for generic state
              return p.projectActors?.some((link: any) => link.actorId === entityId);
            } else if (entityType === 'contact') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Used for generic state
              return p.projectContacts?.some((link: any) => link.contactId === entityId);
            }
            return false;
          });

          filtered.sort((a, b) => new Date(b.modifiedOn).getTime() - new Date(a.modifiedOn).getTime());
          
          setProjects(filtered);
        }
      } catch (err) {
        toast.error('Failed to load projects');
        reportError(err, 'ProjectsTab');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [entityId, entityType]);

  if (loading) {
    return <div className="text-gray-500 text-sm py-4">Loading projects...</div>;
  }

  return (
    <div className="flex flex-col gap-3 max-w-5xl">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined">folder</span>
            Projects
          </h3>
        </div>
        <div className="flex flex-col gap-4">
          {projects.length > 0 ? (
            projects.map((p) => (
              <ProjectCard key={p.projectId} project={p} />
            ))
          ) : (
            <div className="text-gray-500 text-sm py-4">No projects found for this {entityType}.</div>
          )}
        </div>
      </div>
    </div>
  );
}
