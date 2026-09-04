'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as api from '@herobm/sdk';
import type { CreateCrmActivityDto, UserResponseDto } from '@herobm/sdk';
import SlideOver from './SlideOver';
import { Button } from './Button';
import ContactSelect, { type Contact } from './ContactSelect';

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
  entityType?: 'actor' | 'contact' | 'opportunity';
  entityId?: string;
  entityName?: string;
  opportunityContacts?: OpportunityContactItem[];
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
}: LogActivityModalProps) {
  const t = useTranslations('crm.activities');
  const [type, setType] = useState<'call' | 'meeting' | 'email' | 'task'>(defaultType);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<SelectedContactItem[]>([]);
  const [usersList, setUsersList] = useState<UserResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setSubject('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setAssignedToUserId('');
      if (entityType === 'contact' && entityId) {
        setSelectedContacts([{ contactId: entityId, fullName: entityName || 'Contact' }]);
      } else {
        setSelectedContacts([]);
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
  }, [isOpen, defaultType, entityType, entityId, entityName]);

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
      const payload: CreateCrmActivityDto = {
        type,
        subject: subject.trim(),
        description: description.trim() || undefined,
        status: type === 'task' ? 'open' : 'completed',
        priority,
      };

      if (entityType === 'actor' && entityId) {
        payload.actorId = entityId;
      } else if (entityType === 'contact' && entityId) {
        if (!selectedContacts.some((c) => c.contactId === entityId)) {
          selectedContacts.push({ contactId: entityId, fullName: entityName || 'Contact' });
        }
      } else if (entityType === 'opportunity' && entityId) {
        payload.opportunityId = entityId;
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
      onSuccess();
      onClose();
    } catch {
      toast.error(t('toasts.failedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
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
        entityName ? (
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
            {submitting ? t('actions.saving') : t('actions.create')}
          </Button>
        </div>
      }
    >
      <form id="log-activity-form" onSubmit={handleSubmit} className="flex flex-col gap-5 p-1">
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

        {/* Priority */}
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

        {/* Task-specific fields: Due Date and Assignee */}
        {type === 'task' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]">
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

          {/* Quick select from Opportunity Contacts if available */}
          {opportunityContacts && opportunityContacts.length > 0 && (
            <div className="mb-2.5">
              <div className="text-[11px] text-[var(--text-muted)] mb-1.5 font-medium">
                Opportunity contacts:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {opportunityContacts.map((oc) => {
                  const cId = oc.contactId;
                  const name =
                    oc.contact?.fullName ||
                    `${oc.contact?.firstName || ''} ${oc.contact?.lastName || ''}`.trim() ||
                    'Contact';
                  const isSelected = selectedContacts.some((x) => x.contactId === cId);

                  return (
                    <Button
                      key={cId}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedContacts((prev) => prev.filter((x) => x.contactId !== cId));
                        } else {
                          setSelectedContacts((prev) => [
                            ...prev,
                            { contactId: cId, fullName: name, email: oc.contact?.email },
                          ]);
                        }
                      }}
                      className={`!inline-flex !items-center !gap-1 !px-2.5 !py-1 !rounded-full !text-xs !font-medium transition-colors !border ${
                        isSelected
                          ? '!bg-[var(--accent)] !text-white !border-[var(--accent)]'
                          : '!bg-[var(--bg-card)] !text-[var(--text-secondary)] !border-[var(--border)] hover:!border-[var(--border-strong)]'
                      }`}
                    >
                      {isSelected ? (
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      ) : (
                        /* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */
                        <span className="material-symbols-outlined text-[13px]">add</span>
                      )}
                      <span>{name}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Searchable Contact Picker */}
          <ContactSelect
            value={null}
            placeholder="Search and attach contact..."
            onChange={handleAddContact}
          />

          {/* Selected Contacts Badges */}
          {selectedContacts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedContacts.map((c) => (
                <span
                  key={c.contactId}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30"
                >
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material symbols are not translated */}
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  <span>{c.fullName}</span>
                  {entityType !== 'contact' || entityId !== c.contactId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedContacts((prev) => prev.filter((x) => x.contactId !== c.contactId))
                      }
                      className="!p-0.5 !h-auto hover:opacity-70 focus:outline-none"
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
