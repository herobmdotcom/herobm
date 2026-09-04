'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { useAuth } from '@/components/AuthGate';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DetailsLayout from '@/components/shared/DetailsLayout';
import EntityHeader from '@/components/shared/EntityHeader';
import PageNav from '@/components/shared/PageNav';
import { Button } from '@/components/shared/Button';
import { ContactListTab } from '@/components/shared/ContactListTab';
import { ActorCard } from '@/components/shared/ActorCard';
import { ActorSlideOver } from '@/components/shared/ActorSlideOver';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import CrmActivitiesSection from '@/components/shared/CrmActivitiesSection';
import { useSettings } from '@/components/SettingsProvider';
import { OPPORTUNITY_STATE, SystemResource, hasPermission, getErrorMessage } from '@herobm/shared';
import { useAutoSaveEntity } from '@/hooks/useAutoSaveEntity';
import OpportunityCommercialTab from './components/OpportunityCommercialTab';

interface OpportunityFormDto {
  name: string;
  type: string;
  status: string;
  ownerId?: string | null;
  estimatedValue?: string | null;
  currencyCode?: string | null;
  targetCloseDate?: string | null;
  probability?: number | null;
  actualValue?: string | null;
  description?: string | null;
  createdOn: string;
  modifiedOn: string;
}

function GeneralInfoTab({
  dto,
  updateField,
  saveField,
  loading,
  users,
  appSettings,
  baseCurrency,
  dealRevenue,
  onSelectTab,
}: {
  dto: OpportunityFormDto;
  updateField: (field: string, value: unknown) => void;
  saveField: (field: keyof api.UpdateOpportunityDto, value: unknown) => void;
  loading: boolean;
  users: api.UserResponseDto[];
  appSettings: api.AppConfigResponseDto | null;
  baseCurrency?: string;
  dealRevenue?: number | null;
  onSelectTab?: (tab: 'overview' | 'commercial' | 'contacts' | 'actors') => void;
}) {
  return (
    <div className="max-w-5xl flex flex-col gap-6">
      {/* General Information Card */}
      <div className="card p-6 flex flex-col gap-4">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">info</span>
          General Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Opportunity Name *
            </label>
            <input
              type="text"
              className="input w-full font-semibold"
              value={dto.name}
              onChange={(e) => updateField('name', e.target.value)}
              onBlur={(e) => saveField('name', e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Opportunity Owner
            </label>
            <select
              className="input w-full"
              value={dto.ownerId || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                updateField('ownerId', val);
                saveField('ownerId', val);
              }}
              disabled={loading}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName || u.username}{u.email ? ` (${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Pipeline Stage *
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
              {[...(appSettings?.opportunityStages || appSettings?.projectStatuses || [])]
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.value}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              {[...(appSettings?.opportunityTypes || appSettings?.projectTypes || [])]
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Created On
            </label>
            <input
              type="text"
              className="input w-full"
              value={dto.createdOn ? new Date(dto.createdOn).toLocaleString() : ''}
              disabled
            />
          </div>
        </div>
      </div>

      {/* Forecast Card */}
      <div id="forecast-section" className="card p-6 flex flex-col gap-4">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">trending_up</span>
          Forecast
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Estimated Deal Value
            </label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={dto.estimatedValue || ''}
              onChange={(e) => updateField('estimatedValue', e.target.value)}
              onBlur={(e) => saveField('estimatedValue', e.target.value || undefined)}
              placeholder="0.00"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Currency
            </label>
            <select
              className="input w-full"
              value={dto.currencyCode || baseCurrency || ''}
              onChange={(e) => {
                updateField('currencyCode', e.target.value);
                saveField('currencyCode', e.target.value);
              }}
              disabled={loading}
            >
              {baseCurrency && (
                <option value={baseCurrency}>
                  {baseCurrency} (System Base)
                </option>
              )}
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD']
                .filter((c) => c !== baseCurrency)
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Win Probability
              </label>
              <span className="text-xs font-bold text-[var(--accent)]">
                {dto.probability ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              className="w-full mt-2 accent-[var(--accent)] cursor-pointer"
              value={dto.probability ?? 50}
              onChange={(e) => updateField('probability', Number(e.target.value))}
              onMouseUp={(e) => saveField('probability', Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => saveField('probability', Number((e.target as HTMLInputElement).value))}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Target Close Date
            </label>
            <input
              type="date"
              className="input w-full"
              value={dto.targetCloseDate ? dto.targetCloseDate.slice(0, 10) : ''}
              onChange={(e) => {
                updateField('targetCloseDate', e.target.value);
                saveField('targetCloseDate', e.target.value ? new Date(e.target.value).toISOString() : undefined);
              }}
              disabled={loading}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Description & Deal Scope
            </label>
            <textarea
              rows={3}
              className="input w-full"
              value={dto.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              onBlur={(e) => saveField('description', e.target.value || undefined)}
              placeholder="Key customer drivers, commercial scope, competitor details..."
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Revenue Section Card */}
      <div id="revenue-section" className="card p-6 flex flex-col gap-4">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">payments</span>
          Revenue
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Live Deal Revenue
            </label>
            <div className="input bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] flex items-center justify-between min-w-0 select-none">
              <span className="tabular-nums font-medium whitespace-nowrap">
                {(dto.currencyCode || baseCurrency)
                  ? new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: dto.currencyCode || baseCurrency,
                      minimumFractionDigits: 2,
                    }).format(Number(dealRevenue || 0))
                  : Number(dealRevenue || 0).toLocaleString()}
              </span>
              <div className="text-xs truncate ml-2 text-right">
                {onSelectTab ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectTab('commercial')}
                    className="p-0 h-auto text-xs font-normal text-[var(--accent)] hover:underline"
                  >
                    View in Commercial
                  </Button>
                ) : (
                  <span className="text-[var(--text-muted)]">Quotes & Orders</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              Actual Won Value
            </label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={dto.actualValue || ''}
              onChange={(e) => updateField('actualValue', e.target.value)}
              onBlur={(e) => saveField('actualValue', e.target.value || undefined)}
              placeholder="0.00"
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesTab({
  opportunityId,
  notes,
  onNoteAdded,
}: {
  opportunityId: string;
  notes: api.OpportunityNoteResponseDto[];
  onNoteAdded: () => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddNote = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.opportunitiesControllerAddNote(opportunityId, { content });
      toast.success('Note added');
      setContent('');
      onNoteAdded();
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <div className="card p-6 flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-none">
        <h3 className="section-heading mb-0">
          <span className="material-symbols-outlined">edit_note</span>
          Notes
        </h3>
        <textarea
          className="input w-full min-h-[100px]"
          rows={3}
          placeholder="Type an internal note about this opportunity..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={submitting || !content.trim()}
          >
            Add Note
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <div
            key={n.noteId}
            className="p-4 flex flex-col gap-1 border border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-none"
          >
            <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
              {n.content}
            </div>
            <div className="text-xs text-[var(--text-muted)] flex justify-between mt-2 pt-2 border-t border-[var(--border)]">
              <span>
                By:{' '}
                {String(
                  (n.createdBy as Record<string, unknown> | undefined)?.displayName ||
                    (n.createdBy as Record<string, unknown> | undefined)?.username ||
                    n.createdById ||
                    '—',
                )}
              </span>
              <span>{new Date(n.createdOn).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-sm text-[var(--text-muted)] italic text-center p-8 border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-muted)]/50">
            No notes logged for this opportunity yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ActorsTab({
  opportunityId,
  actors,
  onActorAdded,
}: {
  opportunityId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We can't type this strictly since the SDK defines it as a generic object with unknown properties
  actors: any[];
  onActorAdded: () => void;
}) {
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
      await api.opportunitiesControllerDeleteActor(opportunityId, actorId);
      toast.success('Stakeholder unlinked');
      onActorAdded();
    } catch {
      toast.error('Failed to unlink stakeholder');
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-5xl">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <h3 className="section-heading m-0">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
            <span className="material-symbols-outlined">business</span>
            Stakeholders & Companies
          </h3>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingActor(null);
              setIsAdding(true);
            }}
          >
            Add Stakeholder
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actors && actors.length > 0 ? (
            actors.map((link) => {
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
                  deleteTitle="Unlink Stakeholder"
                />
              );
            })
          ) : (
            <div className="text-gray-500 text-sm py-4">
              No companies or partners linked.
            </div>
          )}
        </div>
      </div>

      <ActorSlideOver
        isOpen={isAdding}
        onClose={() => {
          setIsAdding(false);
          setEditingActor(null);
        }}
        opportunityId={opportunityId}
        onSaved={onActorAdded}
        editingActor={editingActor}
      />
    </div>
  );
}

export default function EditOpportunityClient({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions } = useAuth();
  const canArchive = hasPermission(permissions, SystemResource.CRM, 'archive');
  const { app: appSettings, baseCurrency } = useSettings();

  const [activeTab, setActiveTab] = useState<'overview' | 'commercial' | 'contacts' | 'actors'>('overview');
  const [users, setUsers] = useState<api.UserResponseDto[]>([]);

  const {
    entity: opportunity,
    dto,
    updateField,
    saveField,
    loading,
    loadEntity: loadOpportunity,
  } = useAutoSaveEntity<api.OpportunityResponseDto, OpportunityFormDto>({
    id,
    fetchFn: api.opportunitiesControllerFindOne,
    updateFn: (oppId, updateDto) =>
      api.opportunitiesControllerUpdate(oppId, updateDto as api.UpdateOpportunityDto),
    mapEntityToDto: (data) => ({
      name: data.name || '',
      type: data.type || '',
      status: data.status || '',
      ownerId: data.ownerId ?? null,
      estimatedValue: data.estimatedValue ?? null,
      currencyCode: data.currencyCode || baseCurrency || '',
      targetCloseDate: data.targetCloseDate ?? null,
      probability: data.probability ?? null,
      actualValue: data.actualValue ?? null,
      description: data.description ?? null,
      createdOn: (data.createdOn as unknown as string) || '',
      modifiedOn: (data.modifiedOn as unknown as string) || '',
    }),
  });

  useDocumentTitle(opportunity?.name ? `${opportunity.name} - Opportunity` : 'Opportunity Details');

  useEffect(() => {
    api.usersControllerFindAll()
      .then((res) => {
        const u = res.data;
        const list = Array.isArray(u) ? u : (u as unknown as { data: api.UserResponseDto[] })?.data || [];
        setUsers(list);
      })
      .catch(() => {});
  }, []);

  const archiveOpportunity = async () => {
    if (!confirm('Are you sure you want to archive this opportunity?')) return;
    try {
      await api.opportunitiesControllerArchive(id, {});
      toast.success('Opportunity archived');
      loadOpportunity();
    } catch (e) {
      toast.error(getErrorMessage(e));
      reportError(e, 'Archive Opportunity');
    }
  };

  const unarchiveOpportunity = async () => {
    try {
      await api.opportunitiesControllerUnarchive(id, {});
      toast.success('Opportunity unarchived');
      loadOpportunity();
    } catch (e) {
      toast.error(getErrorMessage(e));
      reportError(e, 'Unarchive Opportunity');
    }
  };

  const saveFieldWrapper = async (field: keyof api.UpdateOpportunityDto, value: unknown) => {
    if (field === 'name' && !(typeof value === 'string' ? value : '').trim()) {
      toast.error('Name is required');
      return;
    }
    await saveField(field as keyof OpportunityFormDto, value);
  };

  const navItems = [
    {
      id: 'tab-overview',
      label: 'Overview',
      isSubPage: true,
      isActive: activeTab === 'overview',
      onClick: () => setActiveTab('overview'),
      subtargets: [
        {
          id: 'info-section',
          label: 'Info',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('info-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
        {
          id: 'forecast-section',
          label: 'Forecast',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('forecast-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
        {
          id: 'revenue-section',
          label: 'Revenue',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('revenue-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
        {
          id: 'activities-section',
          label: 'Activities',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('activities-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
        {
          id: 'notes-section',
          label: 'Notes',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('notes-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
        {
          id: 'activity-section',
          label: 'System Log',
          onClick: () => {
            setActiveTab('overview');
            setTimeout(
              () =>
                document
                  .getElementById('activity-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              50,
            );
          },
        },
      ],
    },
    {
      id: 'tab-commercial',
      label: 'Commercial',
      isSubPage: true,
      isActive: activeTab === 'commercial',
      onClick: () => setActiveTab('commercial'),
    },
    {
      id: 'tab-contacts',
      label: 'Contacts',
      isSubPage: true,
      isActive: activeTab === 'contacts',
      onClick: () => setActiveTab('contacts'),
    },
    {
      id: 'tab-actors',
      label: 'Stakeholders',
      isSubPage: true,
      isActive: activeTab === 'actors',
      onClick: () => setActiveTab('actors'),
    },
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={dto?.name || 'Loading...'}
          badges={
            dto?.status ? (
              <span className="badge bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold border border-[var(--border)] px-2.5 py-1 rounded-full text-xs uppercase">
                {dto.status}
              </span>
            ) : undefined
          }
          showPrint={false}
          nav={<PageNav sections={navItems} />}
        />
      }
      footerActions={
        canArchive && opportunity ? (
          opportunity.stateCode === OPPORTUNITY_STATE.ARCHIVED ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={unarchiveOpportunity}
              disabled={loading}
            >
              Unarchive
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="text-red-500 border-red-500 hover:!bg-red-50"
              onClick={archiveOpportunity}
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
                users={users}
                appSettings={appSettings as unknown as api.AppConfigResponseDto | null}
                baseCurrency={baseCurrency}
                dealRevenue={opportunity?.dealRevenue}
                onSelectTab={setActiveTab}
              />
            </div>
            <div id="activities-section">
              <CrmActivitiesSection
                entityType="opportunity"
                entityId={id}
                entityName={opportunity?.name}
                opportunityContacts={
                  ((opportunity?.opportunityContacts ||
                    (opportunity as unknown as { projectContacts?: unknown[] })?.projectContacts ||
                    []) as unknown as Parameters<typeof CrmActivitiesSection>[0]['opportunityContacts'])
                }
                onActivityLogged={loadOpportunity}
              />
            </div>
            <div id="notes-section">
              <NotesTab
                opportunityId={id}
                notes={opportunity?.notes || []}
                onNoteAdded={loadOpportunity}
              />
            </div>
            <div id="activity-section">
              <ActivityTimeline
                events={((opportunity as unknown as { events?: unknown[] })?.events || []) as unknown as []}
              />
            </div>
          </div>
        )}

        {activeTab === 'commercial' && (
          <OpportunityCommercialTab
            opportunityId={id}
            opportunityName={opportunity?.name}
            currencyCode={opportunity?.currencyCode}
            dealRevenue={opportunity?.dealRevenue}
            quoteCount={opportunity?.quoteCount}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactListTab
            entityId={id}
            entityType="opportunity"
            contacts={((opportunity?.opportunityContacts || (opportunity as unknown as { projectContacts?: unknown[] })?.projectContacts || []) as unknown as Parameters<typeof ContactListTab>[0]['contacts'])}
            onContactAdded={loadOpportunity}
          />
        )}

        {activeTab === 'actors' && (
          <ActorsTab
            opportunityId={id}
            actors={((opportunity?.opportunityActors || (opportunity as unknown as { projectActors?: unknown[] })?.projectActors || []) as unknown as unknown[])}
            onActorAdded={loadOpportunity}
          />
        )}
      </>
    </DetailsLayout>
  );
}
