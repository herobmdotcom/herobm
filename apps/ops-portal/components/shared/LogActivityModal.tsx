'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type {
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  UpdateCrmActivityDtoPriority,
  UserResponseDto,
  CrmActivityResponseDto,
} from '@herobm/sdk';
import SlideOver from './SlideOver';
import { Button } from './Button';
import ContactSelect, { type Contact } from './ContactSelect';
import OpportunitySelect, { type OpportunityOption } from './OpportunitySelect';

export interface OpportunityContactItem {
  contactId: string;
  contact?: {
    contactId?: string;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  roles?: string[] | null;
}

export interface SelectedContactItem {
  contactId: string;
  fullName: string;
  email?: string | null;
}

export interface LogActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'call' | 'meeting' | 'email' | 'task';
  entityType?: 'actor' | 'organization' | 'contact' | 'opportunity';
  entityId?: string;
  entityName?: string;
  opportunityContacts?: OpportunityContactItem[];
  activityToEdit?: CrmActivityResponseDto | null;
}

export default function LogActivityModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'call',
  entityType,
  entityId,
  entityName,
  opportunityContacts,
  activityToEdit,
}: LogActivityModalProps) {
  const t = useTranslations('crm.activities');
  const [type, setType] = useState<'call' | 'meeting' | 'email' | 'task'>(defaultType);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [selectedOpportunityName, setSelectedOpportunityName] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<SelectedContactItem[]>([]);
  const [usersList, setUsersList] = useState<UserResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activityToEdit) {
        setType((activityToEdit.type as typeof type) || 'task');
        setSubject(activityToEdit.subject || '');
        setDescription(activityToEdit.description || '');
        setPriority((activityToEdit.priority as typeof priority) || 'medium');
        setDueDate(activityToEdit.dueDate ? activityToEdit.dueDate.slice(0, 10) : '');
        setAssignedToUserId(activityToEdit.assignedToUserId || '');
        setSelectedOpportunityId(activityToEdit.opportunityId || null);
        setSelectedOpportunityName(activityToEdit.opportunityName || '');
        setSelectedContacts(
          activityToEdit.contacts?.map((c) => ({
            contactId: c.contactId,
            fullName: c.fullName || c.email || 'Contact',
            email: c.email,
          })) || [],
        );
      } else {
        setType(defaultType);
        setSubject('');
        setDescription('');
        setPriority('medium');
        setDueDate('');
        setAssignedToUserId('');
        if (entityType === 'opportunity' && entityId) {
          setSelectedOpportunityId(entityId);
          setSelectedOpportunityName(entityName || 'Opportunity');
        } else {
          setSelectedOpportunityId(null);
          setSelectedOpportunityName('');
        }
        if (entityType === 'contact' && entityId) {
          setSelectedContacts([{ contactId: entityId, fullName: entityName || 'Contact' }]);
        } else {
          setSelectedContacts([]);
        }
      }

      // Load users for task assignment via SDK
      api
        .usersControllerFindAll()
        .then((res) => {
          const list = (res.data as unknown as UserResponseDto[]) || [];
          setUsersList(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          // ignore
        });
    }
  }, [isOpen, defaultType, entityType, entityId, entityName, activityToEdit]);

  const handleAddContact = (c: Contact | null) => {
    if (!c) return;
    if (!selectedContacts.some((x) => x.contactId === c.contactId)) {
      const fullName = c.fullName || `${c.firstName} ${c.lastName}`.trim() || 'Contact';
      setSelectedContacts((prev) => [...prev, { contactId: c.contactId, fullName, email: c.email }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setSubmitting(true);
    try {
      if (activityToEdit) {
        const updatePayload: UpdateCrmActivityDto = {
          type: type as api.UpdateCrmActivityDto['type'],
          subject: subject.trim(),
          description: description.trim() || undefined,
          priority: type === 'task' ? priority : (activityToEdit.priority as UpdateCrmActivityDtoPriority || 'medium'),
          opportunityId: selectedOpportunityId || undefined,
          dueDate: type === 'task' && dueDate ? new Date(dueDate).toISOString() : undefined,
          assignedToUserId: type === 'task' ? (assignedToUserId || undefined) : undefined,
          contactIds: selectedContacts.map((c) => c.contactId),
        };
        await api.crmActivitiesControllerUpdate(activityToEdit.activityId, updatePayload);
        toast.success(t('toasts.updated'));
      } else {
        const payload: CreateCrmActivityDto = {
          type: type as api.CreateCrmActivityDto['type'],
          subject: subject.trim(),
          description: description.trim() || undefined,
          status: type === 'task' ? 'open' : 'completed',
          priority: type === 'task' ? priority : 'medium',
        };

        if ((entityType === 'actor' || entityType === 'organization') && entityId) {
          payload.organizationId = entityId;
        } else if (entityType === 'contact' && entityId) {
          if (!selectedContacts.some((c) => c.contactId === entityId)) {
            selectedContacts.push({ contactId: entityId, fullName: entityName || 'Contact' });
          }
        } else if (entityType === 'opportunity' && entityId) {
          payload.opportunityId = entityId;
        }

        if (selectedOpportunityId) {
          payload.opportunityId = selectedOpportunityId;
        }

        if (selectedContacts.length > 0) {
          payload.contactIds = selectedContacts.map((c) => c.contactId);
        }

        if (type === 'task') {
          if (dueDate) {
            payload.dueDate = new Date(dueDate).toISOString();
          }
          if (assignedToUserId) {
            payload.assignedToUserId = assignedToUserId;
          }
        }

        await api.crmActivitiesControllerCreate(payload);
        toast.success(t('toasts.created'));
      }
      onSuccess();
      onClose();
    } catch {
      toast.error(t(activityToEdit ? 'toasts.failedToUpdate' : 'toasts.failedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    if (activityToEdit) {
      switch (type) {
        case 'call':
          return t('modal.editCall');
        case 'meeting':
          return t('modal.editMeeting');
        case 'email':
          return t('modal.editEmail');
        case 'task':
          return t('modal.editTask');
        default:
          return t('modal.editGeneric');
      }
    }
    switch (type) {
      case 'call':
        return t('modal.titleCall');
      case 'meeting':
        return t('modal.titleMeeting');
      case 'email':
        return t('modal.titleEmail');
      case 'task':
        return t('modal.titleTask');
      default:
        return t('modal.titleGeneric');
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      subtitle={
        entityName && entityType !== 'opportunity' ? (
          <span className="text-xs text-[var(--accent)] font-medium">
            {entityType ? `${entityType.toUpperCase()}: ` : ''}
            {entityName}
          </span>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="log-activity-form"
            variant="primary"
            disabled={submitting || !subject.trim()}
          >
            {submitting ? t('actions.saving') : activityToEdit ? t('actions.save') : t('actions.create')}
          </Button>
        </div>
      }
    >
      <form id="log-activity-form" onSubmit={handleSubmit} className="flex flex-col gap-5 p-1">
        {/* Opportunity Selection */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            {t('fields.opportunity')}
          </label>
          <OpportunitySelect
            value={selectedOpportunityId}
            initialSearchTerm={selectedOpportunityName}
            disabled={entityType === 'opportunity'}
            placeholder={t('fields.opportunity')}
            onChange={(opp: OpportunityOption | null) => {
              setSelectedOpportunityId(opp ? opp.opportunityId : null);
              setSelectedOpportunityName(opp ? opp.name : '');
            }}
          />
        </div>

        {/* Interaction Type Selector */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            {t('fields.type')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'call', icon: 'call', label: t('types.call') },
              { id: 'meeting', icon: 'groups', label: t('types.meeting') },
              { id: 'email', icon: 'mail', label: t('types.email') },
              { id: 'task', icon: 'check_box', label: t('types.task') },
            ].map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                onClick={() => setType(item.id as typeof type)}
                className={`!flex !flex-col !items-center !justify-center !p-2.5 !h-auto rounded-lg border text-xs font-medium transition-all ${
                  type === item.id
                    ? '!border-[var(--accent)] !bg-[var(--accent)]/10 !text-[var(--accent)] shadow-sm'
                    : '!border-[var(--border)] !bg-[var(--bg-card)] !text-[var(--text-secondary)] hover:!border-[var(--border-strong)]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] mb-1">{item.icon}</span>
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            {t('fields.subject')} *
          </label>
          <input
            className="input w-full text-sm"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              type === 'call'
                ? 'e.g., Follow up on pricing quote'
                : type === 'meeting'
                ? 'e.g., Project kickoff & technical discovery'
                : type === 'email'
                ? 'e.g., Sent product specifications catalog'
                : 'e.g., Review contract terms before Friday'
            }
          />
        </div>

        {/* Priority (only relevant for Tasks) */}
        {type === 'task' && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              {t('fields.priority')}
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                const colors: Record<string, string> = {
                  low: '!border-slate-300 dark:!border-slate-700 data-[selected=true]:!border-slate-500 data-[selected=true]:!bg-slate-500/10 !text-slate-600 dark:!text-slate-400',
                  medium:
                    '!border-blue-300 dark:!border-blue-800 data-[selected=true]:!border-blue-500 data-[selected=true]:!bg-blue-500/10 !text-blue-600 dark:!text-blue-400',
                  high: '!border-amber-300 dark:!border-amber-800 data-[selected=true]:!border-amber-500 data-[selected=true]:!bg-amber-500/10 !text-amber-600 dark:!text-amber-400',
                  urgent:
                    '!border-red-300 dark:!border-red-800 data-[selected=true]:!border-red-500 data-[selected=true]:!bg-red-500/10 !text-red-600 dark:!text-red-400',
                };
                return (
                  <Button
                    key={p}
                    type="button"
                    variant="ghost"
                    data-selected={priority === p}
                    onClick={() => setPriority(p)}
                    className={`!flex-1 !py-1.5 !px-2 rounded-lg border text-xs font-semibold capitalize transition-all ${colors[p]}`}
                  >
                    {t(`priorities.${p}`)}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Task-specific fields: Due Date and Assignee */}
        {type === 'task' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {t('fields.dueDate')}
              </label>
              <input
                type="date"
                className="input w-full text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {t('fields.assignedTo')}
              </label>
              <select
                className="input w-full text-sm"
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {usersList.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Contacts (Optional multi-contact attachment) */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            Contacts
          </label>

          {/* Quick select from Opportunity Contacts if available (unselected only) */}
          {opportunityContacts &&
            opportunityContacts.filter(
              (oc) => !selectedContacts.some((sc) => sc.contactId === oc.contactId)
            ).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {opportunityContacts
                  .filter((oc) => !selectedContacts.some((sc) => sc.contactId === oc.contactId))
                  .map((oc) => {
                    const cId = oc.contactId;
                    const name =
                      oc.contact?.fullName ||
                      `${oc.contact?.firstName || ''} ${oc.contact?.lastName || ''}`.trim() ||
                      'Contact';

                    return (
                      <Button
                        key={cId}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedContacts((prev) => [
                            ...prev,
                            { contactId: cId, fullName: name, email: oc.contact?.email },
                          ]);
                        }}
                        className="!inline-flex !items-center !gap-1.5 !text-[11px] !font-medium !px-2 !py-0.5 !h-6 !rounded-md !border !border-[var(--border)] !bg-[var(--surface-muted)] !text-[var(--text-secondary)] hover:!border-[var(--accent)] hover:!text-[var(--accent)] transition-colors cursor-pointer"
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                        <span className="material-symbols-outlined text-[13px] text-[var(--accent)]">person</span>
                        <span>{name}</span>
                      </Button>
                    );
                  })}
              </div>
            )}

          {/* Searchable Contact Picker */}
          <ContactSelect
            value={null}
            placeholder="Search and attach contact..."
            onChange={handleAddContact}
            clearOnSelect={true}
          />

          {/* Selected Contacts Badges (Consistent treatment for all selected contacts) */}
          {selectedContacts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedContacts.map((c) => (
                <span
                  key={c.contactId}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 h-6 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
                >
                  <Link
                    href={`/crm/contacts/${c.contactId}`}
                    className="inline-flex items-center gap-1 hover:underline text-[var(--accent)]"
                    title={`View ${c.fullName}`}
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                    <span className="material-symbols-outlined text-[13px] text-[var(--accent)]">person</span>
                    <span>{c.fullName}</span>
                  </Link>
                  {entityType !== 'contact' || entityId !== c.contactId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedContacts((prev) => prev.filter((x) => x.contactId !== c.contactId))
                      }
                      className="!p-0 !h-auto hover:opacity-70 focus:outline-none flex items-center justify-center text-[var(--accent)] ml-0.5"
                      title="Remove contact"
                    >
                      <span className="material-symbols-outlined text-[13px] block">close</span>
                    </Button>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description / Notes */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            {t('fields.description')}
          </label>
          <textarea
            className="input w-full min-h-[120px] text-sm p-3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === 'call'
                ? 'Call summary, key discussion points, and agreed outcomes...'
                : type === 'meeting'
                ? 'Meeting minutes, decisions made, and attendees...'
                : type === 'email'
                ? 'Summary of email correspondence or notes...'
                : 'Detailed task requirements or context...'
            }
          />
        </div>
      </form>
    </SlideOver>
  );
}
