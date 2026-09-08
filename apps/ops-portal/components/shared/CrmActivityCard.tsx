'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CrmActivityResponseDto } from '@herobm/sdk';
import { formatLocalDate } from '@/lib/date';
import { Button } from './Button';

export interface CrmActivityCardProps {
  activity: CrmActivityResponseDto;
  showOpportunity?: boolean;
  onToggleComplete?: (activity: CrmActivityResponseDto) => void;
  onEdit?: (activity: CrmActivityResponseDto) => void;
  className?: string;
}

export function CrmActivityCard({
  activity,
  showOpportunity = true,
  onToggleComplete,
  onEdit,
  className = '',
}: CrmActivityCardProps) {
  const t = useTranslations('crm.activities');
  const isTask = activity.type === 'task';
  const isDone = activity.status === 'completed';
  const isOverdue =
    isTask && !isDone && activity.dueDate && new Date(activity.dueDate).getTime() < Date.now();
  const toggleIcon = isDone ? 'check_circle' : 'radio_button_unchecked';
  const toggleTitle = isDone ? t('actions.markOpen') : t('actions.markComplete');
  const dueLabel = isOverdue ? t('tasks.overdue') : t('tasks.due');

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return t('priorities.urgent');
      case 'high':
        return t('priorities.high');
      case 'medium':
        return t('priorities.medium');
      case 'low':
        return t('priorities.low');
      default:
        return priority;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return 'call';
      case 'meeting':
        return 'groups';
      case 'email':
        return 'mail';
      case 'task':
        return 'task_alt';
      case 'note':
      default:
        return 'description';
    }
  };

  const hasContextLinks =
    (showOpportunity && activity.opportunityId && activity.opportunityName) ||
    (activity.organizationId && activity.organizationName) ||
    (activity.contacts && activity.contacts.length > 0);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.(activity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit?.(activity);
        }
      }}
      className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
        isOverdue
          ? 'bg-rose-500/[0.02] border-rose-200 dark:border-rose-900/40 hover:border-rose-400'
          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)] hover:shadow-xs'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Left Column: Task Checkbox or Activity Type Icon */}
        {isTask ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete?.(activity);
            }}
            className={`!p-1 !h-auto rounded-md transition-colors mt-0.5 shrink-0 ${
              isDone
                ? '!text-emerald-600 dark:!text-emerald-400'
                : '!text-[var(--text-muted)] hover:!text-[var(--accent)]'
            }`}
            title={toggleTitle}
          >
            <span className="material-symbols-outlined text-[22px]">
              {toggleIcon}
            </span>
          </Button>
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[18px]">
              {getActivityIcon(activity.type)}
            </span>
          </div>
        )}

        {/* Main Details Column */}
        <div className="flex-1 min-w-0">
          {/* Header Line: Title & Due/Completed Date on left; Task Owner & Priority Badge on right */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
              <span className="font-semibold text-sm text-[var(--text-primary)]">
                {activity.subject}
              </span>

              {/* Task Dates: In same font as title (font-semibold text-sm) without calendar icon */}
              {isTask && (
                <>
                  {isDone && activity.completedAt ? (
                    <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                      {t('tasks.completed')}: {formatLocalDate(activity.completedAt)}
                    </span>
                  ) : activity.dueDate ? (
                    <span
                      className={`font-semibold text-sm shrink-0 ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {dueLabel}: {formatLocalDate(activity.dueDate)}
                    </span>
                  ) : null}
                </>
              )}
            </div>

            {/* Right block: Priority Badge to the left of Task Owner */}
            {(activity.assignedToName || (isTask && activity.priority)) && (
              <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
                {isTask && activity.priority && (
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getPriorityBadgeClass(
                      activity.priority,
                    )}`}
                  >
                    {getPriorityLabel(activity.priority)}
                  </span>
                )}

                {activity.assignedToName && (
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 shrink-0">
                    {/* eslint-disable-next-line i18next/no-literal-string -- Material symbol */}
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    <span>{activity.assignedToName}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sub-row: Linked Entity Badges (Opportunity, Organization, Contacts) */}
          {hasContextLinks && (
            <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
              {/* Opportunity Link: shown on Dashboard/general, hidden on Opportunity page */}
              {showOpportunity && activity.opportunityId && activity.opportunityName && (
                <Link
                  href={`/crm/opportunities/${activity.opportunityId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--accent)] hover:underline border border-[var(--border)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">trending_up</span>
                  <span>{activity.opportunityName}</span>
                </Link>
              )}

              {/* Organization Link */}
              {activity.organizationId && activity.organizationName && (
                <Link
                  href={`/crm/organizations/${activity.organizationId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] transition-colors"
                >
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material symbol */}
                  <span className="material-symbols-outlined text-[13px]">domain</span>
                  <span>{activity.organizationName}</span>
                </Link>
              )}

              {/* Attached Contacts Chips */}
              {activity.contacts && activity.contacts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activity.contacts.map((c) => {
                    const contactLabel = c.fullName || c.email || '';
                    return (
                      <Link
                        key={c.contactId}
                        href={`/crm/contacts/${c.contactId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        {/* eslint-disable-next-line i18next/no-literal-string -- Material symbol */}
                        <span className="material-symbols-outlined text-[13px] text-[var(--accent)]">
                          person
                        </span>
                        <span>{contactLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Description Body */}
          {activity.description && (
            <p className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
              {activity.description}
            </p>
          )}

          {/* Footer Metadata */}
          <div className="mt-2.5 pt-2 border-t border-[var(--border)]/60 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span>
              {t('metadata.loggedBy', {
                user: activity.createdBy || t('metadata.unknownUser'),
              })}
            </span>
            <span>•</span>
            <span>{new Date(activity.createdOn).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CrmActivityCard;
