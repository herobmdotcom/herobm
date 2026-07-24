'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import { ContactSlideOver } from '@/components/shared/ContactSlideOver';
import DataGrid from '@/components/shared/DataGrid';
import { ContactCard } from '@/components/shared/ContactCard';
import { ContactListTab } from '@/components/shared/ContactListTab';
import { ProjectsTab } from '@/components/shared/ProjectsTab';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { COUNTRIES } from '@herobm/shared';
import { extensionTabs } from '@/src/generated/extension-tabs';
import { useSettings } from '@/components/SettingsProvider';

interface ActorFormDto {
  name: string;
  legalStatus: string;
  industry: string;
  businessNumber: string;
  isTaxRegistered: boolean;
  email: string;
  telephone: string;
  fax: string;
  website: string;
  headquartersAddressLine1: string;
  headquartersAddressLine2: string;
  headquartersCity: string;
  headquartersStateOrProvince: string;
  headquartersPostalCode: string;
  headquartersCountry: string;
  tags: string[];
  createdOn: string;
  modifiedOn: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK missing proper inline types for Actor Contacts
type ActorContactWithDetails = any;

function GeneralInfoTab({
  dto,
  updateField,
  saveField,
  loading
}: {
  dto: ActorFormDto;
  updateField: (field: keyof ActorFormDto, value: unknown) => void;
  saveField: (field: keyof api.UpdateActorDto, value: unknown) => void;
  loading: boolean;
}) {
  const { app } = useSettings();
  const actorTags = app?.actorTags || [];

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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Name *</label>
              <input
                type="text"
                className="input w-full"
                value={dto.name}
                onChange={e => updateField('name', e.target.value)}
                onBlur={e => saveField('name', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Industry</label>
              <input
                type="text"
                className="input w-full"
                value={dto.industry}
                onChange={e => updateField('industry', e.target.value)}
                onBlur={e => saveField('industry', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Legal Status</label>
              <input
                type="text"
                className="input w-full"
                value={dto.legalStatus}
                onChange={e => updateField('legalStatus', e.target.value)}
                onBlur={e => saveField('legalStatus', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Website</label>
              <input
                type="text"
                className="input w-full"
                value={dto.website}
                onChange={e => updateField('website', e.target.value)}
                onBlur={e => saveField('website', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Business Number</label>
              <input
                type="text"
                className="input w-full"
                value={dto.businessNumber}
                onChange={e => updateField('businessNumber', e.target.value)}
                onBlur={e => saveField('businessNumber', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Tax Registered</label>
              <div
                className="flex items-center gap-3"
                style={{
                  paddingTop: 6,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  if (loading) return;
                  updateField('isTaxRegistered', !dto.isTaxRegistered);
                  saveField('isTaxRegistered', !dto.isTaxRegistered);
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: dto.isTaxRegistered ? 'var(--accent)' : 'var(--border)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 3,
                      left: dto.isTaxRegistered ? 21 : 3,
                      transition: 'left 0.2s ease',
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {(() => {
                    const yesText = 'Yes';
                    const noText = 'No';
                    return dto.isTaxRegistered ? yesText : noText;
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Tags</label>
            <div className="flex flex-wrap gap-2">
              {[...actorTags].sort((a, b) => Number(a.order) - Number(b.order)).map((r) => {
                const tag = r.value;
                const isActive = dto.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => {
                      const newTags = isActive ? dto.tags.filter(t => t !== tag) : [...dto.tags, tag];
                      updateField('tags', newTags);
                      saveField('tags', newTags);
                    }}
                    disabled={loading}
                  >
                    {tag}
                  </button>
                );
              })}
              {actorTags.length === 0 && (
                <span className="text-sm text-gray-500 italic">No tags configured in CRM settings.</span>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="card" id="address-section">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">location_on</span>
          HEADQUARTERS
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Address Line 1</label>
              <input
                type="text"
                className="input w-full"
                value={dto.headquartersAddressLine1}
                onChange={e => updateField('headquartersAddressLine1', e.target.value)}
                onBlur={e => saveField('headquartersAddressLine1', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Address Line 2</label>
              <input
                type="text"
                className="input w-full"
                value={dto.headquartersAddressLine2}
                onChange={e => updateField('headquartersAddressLine2', e.target.value)}
                onBlur={e => saveField('headquartersAddressLine2', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>City</label>
              <input
                type="text"
                className="input w-full"
                value={dto.headquartersCity}
                onChange={e => updateField('headquartersCity', e.target.value)}
                onBlur={e => saveField('headquartersCity', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>State / Province</label>
              <input
                type="text"
                className="input w-full"
                value={dto.headquartersStateOrProvince}
                onChange={e => updateField('headquartersStateOrProvince', e.target.value)}
                onBlur={e => saveField('headquartersStateOrProvince', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Postal Code</label>
              <input
                type="text"
                className="input w-full"
                value={dto.headquartersPostalCode}
                onChange={e => updateField('headquartersPostalCode', e.target.value)}
                onBlur={e => saveField('headquartersPostalCode', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Country</label>
              <select
                className="input w-full"
                value={dto.headquartersCountry}
                onChange={e => {
                  updateField('headquartersCountry', e.target.value);
                  saveField('headquartersCountry', e.target.value);
                }}
                disabled={loading}
              >
                <option value="">Select a country</option>
                {COUNTRIES.map((c: { code: string; name: string }) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-200 pt-4 mt-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                className="input w-full"
                value={dto.email}
                onChange={e => updateField('email', e.target.value)}
                onBlur={e => saveField('email', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Telephone</label>
              <input
                type="text"
                className="input w-full"
                value={dto.telephone}
                onChange={e => updateField('telephone', e.target.value)}
                onBlur={e => saveField('telephone', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Fax</label>
              <input
                type="text"
                className="input w-full"
                value={dto.fax}
                onChange={e => updateField('fax', e.target.value)}
                onBlur={e => saveField('fax', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesTab({ actorId, notes, onNoteAdded }: { actorId: string; notes: api.ActorNoteResponseDto[]; onNoteAdded: () => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations();

  const handleAddNote = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.actorsControllerAddNote(actorId, { content });
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
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any, no-restricted-syntax -- SDK missing User populated properties and no translation key for system */}
                  <span>{(note.createdBy as any)?.displayName || (note.createdBy as any)?.username || note.createdById || 'System'}</span>
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {note.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Removed inline ContactsTab, using shared ContactListTab instead

export default function EditActorClient({ actorId }: { actorId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations();
  

  
  const initialTab = searchParams.get('tab') as 'overview' | 'contacts' | 'projects' | 'activity' || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const {
    entity: actor,
    dto,
    updateField,
    saveField,
    loading,
    loadEntity: loadActor,
  } = useAutoSaveEntity<api.ActorResponseDto, ActorFormDto>({
    id: actorId,
    fetchFn: api.actorsControllerFindOne,
    updateFn: (id, dto) => api.actorsControllerUpdate(id, dto as api.UpdateActorDto),
    mapEntityToDto: (data) => ({
      name: data.name || '',
      legalStatus: data.legalStatus || '',
      industry: data.industry || '',
      businessNumber: data.businessNumber || '',
      isTaxRegistered: data.isTaxRegistered || false,
      email: data.email || '',
      telephone: data.telephone || '',
      fax: data.fax || '',
      website: data.website || '',
      headquartersAddressLine1: data.headquartersAddressLine1 || '',
      headquartersAddressLine2: data.headquartersAddressLine2 || '',
      headquartersCity: data.headquartersCity || '',
      headquartersStateOrProvince: data.headquartersStateOrProvince || '',
      headquartersPostalCode: data.headquartersPostalCode || '',
      headquartersCountry: data.headquartersCountry || '',
      tags: data.tags || [],
      createdOn: (data.createdOn as unknown as string) || '',
      modifiedOn: (data.modifiedOn as unknown as string) || ''
    }),
  });

  useDocumentTitle(actor ? actor.name : null);

  const saveFieldWrapper = async (field: keyof api.UpdateActorDto, value: unknown) => {
    if (field === 'name' && !(typeof value === 'string' ? value : '').trim()) {
      toast.error('Name is required');
      return;
    }
    await saveField(field as keyof ActorFormDto, value);
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
        { id: 'address-section', label: 'Address', onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('address-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
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
      id: "tab-projects",
      label: "Projects",
      isSubPage: true,
      isActive: activeTab === "projects",
      onClick: () => setActiveTab("projects"),
    },
    ...extensionTabs.filter(t => t.target === 'actors').map(ext => ({
      id: `tab-${ext.id}`,
      label: ext.label,
      isSubPage: true,
      isActive: activeTab === ext.id,
      onClick: () => setActiveTab(ext.id as any) /* eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic tab */,
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
              <GeneralInfoTab dto={dto} updateField={(f, v) => updateField(f as keyof ActorFormDto, v)} saveField={(f, v) => saveFieldWrapper(f as keyof api.UpdateActorDto, v)} loading={loading} />
            </div>
            <NotesTab actorId={actorId} notes={actor?.notes || []} onNoteAdded={loadActor} />
            <div id="activity-section" className="card">
              <ActivityTimeline events={(actor as unknown as { events?: React.ComponentProps<typeof ActivityTimeline>['events'] })?.events || []} />
            </div>
          </div>
        )}
        {activeTab === 'contacts' && (
          <ContactListTab entityId={actorId} entityType="actor" contacts={actor?.actorContactLinks || []} onContactAdded={loadActor} />
        )}
        {activeTab === 'projects' && (
          <ProjectsTab entityId={actorId} entityType="actor" />
        )}

        {extensionTabs.filter(t => t.target === 'actors').map(ext => {
          if (activeTab === ext.id) {
            const Component = ext.component;
            return (
              <div key={ext.id} className="max-w-5xl">
                <Component actorId={actorId} actor={actor} />
              </div>
            );
          }
          return null;
        })}
      </>
    </DetailsLayout>
  );
}
