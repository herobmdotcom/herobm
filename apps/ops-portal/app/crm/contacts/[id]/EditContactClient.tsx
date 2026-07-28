'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useAuth } from '@/components/AuthGate';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import { ProjectsTab } from '@/components/shared/ProjectsTab';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import { CONTACT_STATE, SystemResource, hasPermission } from '@herobm/shared';
import ActivityTimeline from '@/components/shared/ActivityTimeline';

interface ContactFormDto {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  mobile: string;
  createdOn: string;
  modifiedOn: string;
}

function GeneralInfoTab({
  dto,
  updateField,
  saveField,
  loading
}: {
  dto: ContactFormDto;
  updateField: (field: string, value: string | undefined) => void;
  saveField: (field: keyof api.UpdateContactDto, value: string | undefined) => void;
  loading: boolean;
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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>First Name *</label>
              <input
                type="text"
                className="input w-full"
                value={dto.firstName}
                onChange={e => updateField('firstName', e.target.value)}
                onBlur={e => saveField('firstName', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Last Name *</label>
              <input
                type="text"
                className="input w-full"
                value={dto.lastName}
                onChange={e => updateField('lastName', e.target.value)}
                onBlur={e => saveField('lastName', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Job Title</label>
              <input
                type="text"
                className="input w-full"
                value={dto.jobTitle}
                onChange={e => updateField('jobTitle', e.target.value)}
                onBlur={e => saveField('jobTitle', e.target.value)}
                disabled={loading}
              />
            </div>
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone</label>
              <input
                type="text"
                className="input w-full"
                value={dto.phone}
                onChange={e => updateField('phone', e.target.value)}
                onBlur={e => saveField('phone', e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Mobile</label>
              <input
                type="text"
                className="input w-full"
                value={dto.mobile}
                onChange={e => updateField('mobile', e.target.value)}
                onBlur={e => saveField('mobile', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Created On</label>
              <input type="text" className="input w-full bg-gray-50" value={dto.createdOn ? new Date(dto.createdOn).toLocaleString() : ''} disabled />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Last Modified</label>
              <input type="text" className="input w-full bg-gray-50" value={dto.modifiedOn ? new Date(dto.modifiedOn).toLocaleString() : ''} disabled />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditContactClient({ contactId }: { contactId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions } = useAuth();
  const canArchive = hasPermission(permissions, SystemResource.CRM, 'archive');
  const initialTab = (searchParams.get('tab') as 'overview' | 'projects') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const {
    entity: contact,
    dto,
    updateField,
    saveField,
    loading,
    loadEntity: loadContact,
  } = useAutoSaveEntity<api.ContactResponseDto, ContactFormDto>({
    id: contactId,
    fetchFn: api.contactsControllerFindOne,
    updateFn: (id, updateDto) => api.contactsControllerUpdate(id, updateDto as api.UpdateContactDto),
    mapEntityToDto: (data) => ({
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      jobTitle: data.jobTitle || '',
      email: data.email || '',
      phone: data.phone || '',
      mobile: data.mobile || '',
      createdOn: (data.createdOn as unknown as string) || '',
      modifiedOn: (data.modifiedOn as unknown as string) || ''
    }),
  });

  const archiveContact = async () => {
    if (!confirm('Are you sure you want to archive this contact?')) return;
    try {
      await api.contactsControllerArchive(contactId, {});
      toast.success('Contact archived');
      loadContact();
    } catch (e) {
      reportError(e, 'Archive Contact');
    }
  };

  const unarchiveContact = async () => {
    try {
      await api.contactsControllerUnarchive(contactId, {});
      toast.success('Contact unarchived');
      loadContact();
    } catch (e) {
      reportError(e, 'Unarchive Contact');
    }
  };

  useDocumentTitle(contact ? `${contact.firstName} ${contact.lastName}` : null);

  const saveFieldWrapper = async (field: keyof api.UpdateContactDto, value: unknown) => {
    if ((field === 'firstName' || field === 'lastName') && !(typeof value === 'string' ? value : '').trim()) {
      toast.error(`${field} is required`);
      return;
    }
    await saveField(field as keyof ContactFormDto, value);
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
        { id: 'activity-section', label: 'Activity', onClick: () => { setActiveTab('overview'); setTimeout(() => document.getElementById('activity-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } },
      ],
    },
    {
      id: "tab-projects",
      label: "Projects",
      isSubPage: true,
      isActive: activeTab === "projects",
      onClick: () => setActiveTab("projects"),
    },
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={dto?.firstName ? `${dto.firstName} ${dto.lastName}` : 'Loading...'}
          actions={undefined}
          showPrint={false}
          nav={<PageNav sections={navItems} />}
        />
      }
      footerActions={
        canArchive && contact ? (
          contact.stateCode === CONTACT_STATE.ARCHIVED ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={unarchiveContact}
              disabled={loading}
            >
              Unarchive
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              style={{ color: "#ef4444", borderColor: "#ef4444" }}
              onClick={archiveContact}
              disabled={loading}
            >
              Archive
            </Button>
          )
        ) : undefined
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
              />
            </div>
            <div id="activity-section" className="card">
              <ActivityTimeline events={(contact as { events?: React.ComponentProps<typeof ActivityTimeline>['events'] })?.events || []} />
            </div>
          </div>
        )}
        {activeTab === 'projects' && (
          <ProjectsTab entityId={contactId} entityType="contact" />
        )}
      </>
    </DetailsLayout>
  );
}
