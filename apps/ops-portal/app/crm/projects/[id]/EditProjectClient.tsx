'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import { ContactSlideOver } from '@/components/shared/ContactSlideOver';
import { ActorSlideOver } from '@/components/shared/ActorSlideOver';
import DataGrid from '@/components/shared/DataGrid';
import { ContactCard } from '@/components/shared/ContactCard';
import { ContactListTab } from '@/components/shared/ContactListTab';
import { ActorCard } from '@/components/shared/ActorCard';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { extensionTabs } from '@/src/generated/extension-tabs';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';

interface ProjectFormDto {
  name: string;
  type: string;
  status: string;
  ownerId?: string;
  createdOn: string;
  modifiedOn: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- We can't type this strictly since the SDK defines it as a generic object with unknown properties
type ProjectContactWithDetails = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- We can't type this strictly since the SDK defines it as a generic object with unknown properties
type ProjectActorWithDetails = any;

// --- Sub-components ---
function GeneralInfoTab({
  dto,
  updateField,
  saveField,
  loading,
  users,
  appSettings
}: {
  dto: ProjectFormDto;
  updateField: (field: string, value: string | undefined) => void;
  saveField: (field: keyof api.UpdateProjectDto, value: string | undefined) => void;
  loading: boolean;
  users: api.UserResponseDto[];
  appSettings: api.AppConfigResponseDto | null;
}) {
  return (
    <div className="max-w-5xl flex flex-col gap-3">
      <div className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">info</span>
          GENERAL INFO
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Name *
              </label>
              <input
                type="text"
                className="input w-full"
                value={dto.name}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={(e) => saveField('name', e.target.value)}
                placeholder="e.g. Project Apollo"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Type *
              </label>
              <select
                className="input w-full"
                value={dto.type}
                onChange={(e) => {
                  updateField('type', e.target.value);
                  saveField('type', e.target.value);
                }}
                disabled={loading}
              >
                {[...(appSettings?.projectTypes || [])].sort((a, b) => Number(a.order) - Number(b.order)).map(t => (
                  <option key={t.value} value={t.value}>{t.value}</option>
                ))}
                {!appSettings?.projectTypes?.length && (
                  <>
                    <option value="buy_side">Buy Side M&A</option>
                    <option value="sell_side">Sell Side M&A</option>
                    <option value="advisory">Advisory</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Status
              </label>
              <select
                className="input w-full"
                value={dto.status}
                onChange={(e) => {
                  updateField('status', e.target.value);
                  saveField('status', e.target.value);
                }}
                disabled={loading}
              >
                {[...(appSettings?.projectStatuses || [])].sort((a, b) => Number(a.order) - Number(b.order)).map(s => (
                  <option key={s.value} value={s.value}>{s.value}</option>
                ))}
                {!appSettings?.projectStatuses?.length && (
                  <>
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="lost">Lost</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Owner
              </label>
              <select
                className="input w-full"
                value={dto.ownerId || ''}
                onChange={(e) => {
                  const val = e.target.value || undefined;
                  updateField('ownerId', val);
                  saveField('ownerId', val);
                }}
                disabled={loading}
              >
                <option value="">-- Unassigned --</option>
                {users.map((u: api.UserResponseDto) => (
                  <option key={(u as unknown as { userId: string }).userId || u.userId} value={(u as unknown as { userId: string }).userId || u.userId}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Created On
              </label>
              <input
                type="text"
                className="input w-full bg-gray-50"
                value={dto.createdOn ? new Date(dto.createdOn).toLocaleString() : ''}
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Last Modified
              </label>
              <input
                type="text"
                className="input w-full bg-gray-50"
                value={dto.modifiedOn ? new Date(dto.modifiedOn).toLocaleString() : ''}
                disabled
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesTab({ projectId, notes, onNoteAdded }: { projectId: string; notes: api.ProjectNoteResponseDto[]; onNoteAdded: () => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations();

  const handleAddNote = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.projectsControllerAddNote(projectId, { content });
      toast.success('Note added');
      setContent('');
      onNoteAdded();
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime());

  return (
    <div className="max-w-5xl flex flex-col gap-6" id="notes-section">
      <div className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">edit_note</span>
          NOTES
        </h3>
        <textarea
          className="input w-full min-h-[100px] mb-3"
          placeholder="Type your note here..."
          value={content}
          onChange={e => setContent(e.target.value)}
          disabled={submitting}
        />
        <div className="flex justify-end mb-6">
          <Button variant="primary" onClick={handleAddNote} disabled={submitting || !content.trim()}>
            {submitting ? t('common.loading') : t('common.add')}
          </Button>
        </div>

        <div className="flex flex-col gap-6 mt-4">
          {sortedNotes.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No notes found.</p>
          ) : (
            sortedNotes.map(note => (
              <div key={note.noteId} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                <div className="flex items-center gap-1 mb-2 text-xs font-medium text-gray-600">
                  <span>{new Date(note.createdOn).toLocaleString()}</span>
                  <span>-</span>
                  {/* eslint-disable-next-line no-restricted-syntax -- No translation key for this edge case */}
                  <span>{((note.createdBy as unknown as api.UserResponseDto)?.displayName) || ((note.createdBy as unknown as api.UserResponseDto)?.username) || 'Unknown User'}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Removed inline ContactsTab, using shared ContactListTab instead

function ActorsTab({ projectId, actors, onActorAdded }: { projectId: string; actors: ProjectActorWithDetails[]; onActorAdded: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingActor, setEditingActor] = useState<{
    actorId: string;
    name: string;
    industry?: string;
    email?: string;
    roles?: string[];
  } | null>(null);

  const handleUnlink = async (actorId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to unlink ${name}?`)) return;
    try {
      await api.projectsControllerRemoveActor(projectId, actorId);
      toast.success('Actor unlinked successfully');
      onActorAdded();
    } catch (e) {
      toast.error('Failed to unlink actor');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined">business</span>
            Actors
          </h3>
          <Button variant="primary" size="sm" onClick={() => {
            setEditingActor(null);
            setIsAdding(true);
          }}>
            + Add Actor
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actors && actors.length > 0 ? actors.map((link) => {
            const actor = link.actor;
            if (!actor) return null;
            return (
              <ActorCard
                key={actor.actorId}
                actor={actor}
                roles={link.roles}
                onEdit={() => {
                  setEditingActor({
                    actorId: actor.actorId,
                    name: actor.name || '',
                    industry: actor.industry || undefined,
                    email: actor.email || undefined,
                    roles: link.roles || [],
                  });
                  setIsAdding(true);
                }}
                onDelete={() => handleUnlink(actor.actorId, actor.name || '')}
                deleteTitle="Unlink Actor"
              />
            );
          }) : (
            <div className="text-gray-500 text-sm py-4">No actors found.</div>
          )}
        </div>
      </div>

      <ActorSlideOver
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
          setEditingActor(null);
        }}
        projectId={projectId}
        onSaved={onActorAdded}
        editingActor={editingActor}
      />
    </div>
  );
}

// --- Main Page Component ---
export default function EditProjectClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations();
  
  const [users, setUsers] = useState<api.UserResponseDto[]>([]);
  const [appSettings, setAppSettings] = useState<api.AppConfigResponseDto | null>(null);
  
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const {
    entity: project,
    dto,
    updateField,
    saveField,
    loading,
    loadEntity: loadProject,
  } = useAutoSaveEntity<api.ProjectResponseDto, ProjectFormDto>({
    id: projectId,
    fetchFn: api.projectsControllerFindOne,
    updateFn: (id, updateDto) => api.projectsControllerUpdate(id, updateDto as api.UpdateProjectDto),
    mapEntityToDto: (data) => ({
      name: data.name || '',
      type: data.type || 'buy_side',
      status: data.status || 'prospect',
      ownerId: data.ownerId || undefined,
      createdOn: (data.createdOn as unknown as string) || '',
      modifiedOn: (data.modifiedOn as unknown as string) || ''
    }),
  });

  useDocumentTitle(project ? project.name : null);

  useEffect(() => {
    const init = async () => {
      try {
        const usersRes = await api.usersControllerFindAll();
        setUsers(usersRes.data || []);
      } catch (e) {
        reportError(e, 'EditProjectClient - load users');
      }
      try {
        const settingsRes = await api.appConfigControllerGet();
        if (settingsRes.data) {
          setAppSettings(settingsRes.data);
        }
      } catch (e) {
        reportError(e, 'EditProjectClient - load app settings');
      }
    };
    init();
  }, [projectId]);

  const saveFieldWrapper = async (field: keyof api.UpdateProjectDto, value: unknown) => {
    if (field === 'name' && !(typeof value === 'string' ? value : '').trim()) {
      toast.error('Name is required');
      return;
    }
    await saveField(field as keyof ProjectFormDto, value);
  };

  const navItems = [
    {
      id: "tab-overview",
      label: "Overview",
      isSubPage: true,
      isActive: activeTab === "overview",
      onClick: () => setActiveTab("overview"),
      subtargets: [
        { id: 'info-section', label: 'Info', onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'notes-section', label: 'Notes', onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
        { id: 'activity-section', label: 'Activity', onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ],
    },
    {
      id: "tab-contacts",
      label: "Contacts",
      isSubPage: true,
      isActive: activeTab === "contacts",
      onClick: () => setActiveTab("contacts"),
    },
    {
      id: "tab-actors",
      label: "Actors",
      isSubPage: true,
      isActive: activeTab === "actors",
      onClick: () => setActiveTab("actors"),
    },
    ...extensionTabs.filter(t => t.target === 'projects').map(ext => ({
      id: ext.id,
      label: ext.label,
      isSubPage: true,
      isActive: activeTab === ext.id,
      onClick: () => setActiveTab(ext.id),
    }))
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={dto?.name || 'Loading...'}
          actions={undefined}
          showPrint={false}
          nav={<PageNav sections={navItems} />}
        />
      }
    >
      <>
        {activeTab === 'overview' && dto && (
          <div className="flex flex-col gap-6 max-w-5xl">
            <div id="info-section">
              <GeneralInfoTab 
                dto={dto} 
                updateField={updateField as (field: string, value: unknown) => void} 
                saveField={saveFieldWrapper as (field: string, value: unknown) => void} 
                loading={loading} 
                users={users} 
                appSettings={appSettings} 
              />
            </div>
            <NotesTab projectId={projectId} notes={project?.notes || []} onNoteAdded={loadProject} />
            <div id="activity-section">
              <ActivityTimeline events={(project as { events?: React.ComponentProps<typeof ActivityTimeline>['events'] })?.events || []} />
            </div>
          </div>
        )}
        {activeTab === 'contacts' && (
          <ContactListTab entityId={projectId} entityType="project" contacts={project?.projectContacts || []} onContactAdded={loadProject} />
        )}
        {activeTab === 'actors' && (
          <ActorsTab projectId={projectId} actors={project?.projectActors || []} onActorAdded={loadProject} />
        )}
        {extensionTabs.filter(t => t.target === 'projects').map(ext => {
          const Component = ext.component;
          return activeTab === ext.id ? (
            <Component key={ext.id} projectId={projectId} actors={project?.projectActors || []} />
          ) : null;
        })}
      </>
    </DetailsLayout>
  );
}
